import { deployments, ethers } from "hardhat"
import { BigNumberish } from "ethers"
import { ERC1155Test, ERC1155Test__factory, ERC1155VoucherMinter, ERC1155VoucherMinter__factory } from "../artifacts/typechain"

const { BigNumber } = ethers
const { expect } = require("chai")

const setupTest = deployments.createFixture(async (options: any) => {
	const [admin, operator, user, alice] = await ethers.getSigners()

	const ERC1155 = (await ethers.getContractFactory("ERC1155Test")) as ERC1155Test__factory
	const erc1155 = (await ERC1155.deploy("https://whatever/{id}.json")) as ERC1155Test

	const Minter = (await ethers.getContractFactory("ERC1155VoucherMinter")) as ERC1155VoucherMinter__factory
	const minter = (await Minter.deploy(erc1155.address)) as ERC1155VoucherMinter

	// allow minter to mint nfts
	await erc1155.grantRole(await erc1155.MINTER_ROLE(), minter.address)

	// allow operator to sign mint requests
	await minter.grantRole(await minter.MINTER_ROLE(), operator.address)

	return {
		erc1155,
		minter,
		admin,
		operator,
		user,
		alice,
	}
})

describe("ERC1155VoucherMinter", () => {
	it("should mint NFTs", async () => {
		const { erc1155, minter, operator, user } = await setupTest()

		const tokenId = "123"
		const quantity = "19"
		const nonce = getRandomBigNumber()

		// tag::backend-task[]
		// sign request to mint
		const { domain, types, request } = await getTypedRequest(minter.address, user.address, tokenId, quantity, nonce)
		const signature = await operator._signTypedData(domain, types, request)
		// end::backend-task[]

		// mint nfts
		await expect(minter.connect(user).mint({ ...request, signature }))
		  .to.emit(erc1155, "TransferSingle")

		// check user balance
		expect(await erc1155.balanceOf(user.address, tokenId)).to.equal(quantity)

		// check token URI
		expect(await erc1155.uri(tokenId)).to.equal("https://whatever/{id}.json")
	})

	it("should mint NFTs with successive nonces", async () => {
		const { erc1155, minter, operator, user } = await setupTest()

		const tokenId = "123"
		const quantity = BigNumber.from(19)
		let nonce = getRandomBigNumber()

		// sign request to mint
		const { domain, types, request } = await getTypedRequest(minter.address, user.address, tokenId, quantity, nonce)
		let signature = await operator._signTypedData(domain, types, request)

		// mint nfts
		await expect(minter.connect(user).mint({ ...request, signature })).to.emit(erc1155, "TransferSingle")

		// sign new request
		nonce = getRandomBigNumber()
		const typedRequest = await getTypedRequest(minter.address, user.address, tokenId, quantity, nonce)
		signature = await operator._signTypedData(domain, types, typedRequest.request)

		// mint new nfts
		await expect(minter.connect(user).mint({ ...typedRequest.request, signature })).to.emit(erc1155, "TransferSingle")

		// check user balance
		expect(await erc1155.balanceOf(user.address, tokenId)).to.equal(quantity.mul(2))

		// check total supply
		expect(await erc1155.totalSupply(tokenId)).to.equal(quantity.mul(2))
	})

	it("should fail when trying to reuse nonce", async () => {
		const { erc1155, minter, operator, user } = await setupTest()

		const tokenId = "123"
		const quantity = "19"
		const nonce = getRandomBigNumber()

		// sign request to mint
		const { domain, types, request } = await getTypedRequest(minter.address, user.address, tokenId, quantity, nonce)
		const signature = await operator._signTypedData(domain, types, request)

		// mint nfts
		await expect(minter.connect(user).mint({ ...request, signature })).to.emit(erc1155, "TransferSingle")

		// try reusing nonce
		await expect(minter.connect(user).mint({ ...request, signature })).to.be.revertedWith("Nonce consumed")
	})

	it("should allow to change baseURI", async () => {
		const { erc1155, minter, operator, user } = await setupTest()

		const tokenId = "123"
		const quantity = "19"
		const nonce = getRandomBigNumber()

		await erc1155.setBaseURI("https://whateverelse/{id}.json")

		// sign request to mint
		const { domain, types, request } = await getTypedRequest(minter.address, user.address, tokenId, quantity, nonce)
		const signature = await operator._signTypedData(domain, types, request)

		// mint nfts
		await minter.connect(user).mint({ ...request, signature })

		// check token URI
		expect(await erc1155.uri(tokenId)).to.equal("https://whateverelse/{id}.json")
	})

	it("should allow to override URI for each tokenId", async () => {
		const { erc1155, minter, operator, user } = await setupTest()

		const tokenId = "123"
		const quantity = "19"
		const nonce = getRandomBigNumber()

		await erc1155.setURI(tokenId, `https://whateverelse/a-nicer-name-for-token-id-${tokenId}`)

		// sign request to mint
		const { domain, types, request } = await getTypedRequest(minter.address, user.address, tokenId, quantity, nonce)
		const signature = await operator._signTypedData(domain, types, request)

		// mint nfts
		await minter.connect(user).mint({ ...request, signature })

		// check token URI
		expect(await erc1155.uri(tokenId)).to.equal(`https://whateverelse/a-nicer-name-for-token-id-${tokenId}`)
	})
})

// tag::get-typed-request[]
const getTypedRequest = async (
	contract: string,
	to: string,
	tokenId: BigNumberish,
	quantity: BigNumberish,
	nonce: BigNumberish
) => {
	const request: Omit<ERC1155VoucherMinter.MintRequestStruct, "signature"> = {
		to,
		tokenId,
		quantity,
		nonce,
	}

	const { chainId } = await ethers.provider.getNetwork()

	const domain = {
		name: "ERC1155VoucherMinter",
		version: "1",
		verifyingContract: contract,
		chainId,
	}

	const types = {
		MintRequest: [
			{ name: "to", type: "address" },
			{ name: "tokenId", type: "uint256" },
			{ name: "quantity", type: "uint256" },
			{ name: "nonce", type: "uint256" },
		],
	}

	return { domain, types, request }
}
// end::get-typed-request[]

const getRandomBigNumber = (): BigNumberish => {
	return ethers.BigNumber.from(ethers.utils.randomBytes(32))
}
