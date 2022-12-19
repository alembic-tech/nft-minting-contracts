import { expect } from "chai"
import { ethers } from "hardhat"
import { anyUint } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { ERC721MerkleTreeMinter, ERC721MerkleTreeMinter__factory } from "@artifacts/typechain"
import { ERC721Test } from "@artifacts/typechain/contracts/test/ERC721Test"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { WMerkleTree, LeafSignature, LeafSourceObject } from "ethers-merkletree"
import { BigNumberish } from "ethers"

describe("ERC721MerkleTreeMinter", () => {
	let minter: ERC721MerkleTreeMinter
	let nft: ERC721Test
	let admin: SignerWithAddress
	let manager: SignerWithAddress
	let user1: SignerWithAddress
	let user2: SignerWithAddress
	let user3: SignerWithAddress
	const price = ethers.utils.parseEther("1.23")

	beforeEach(async () => {
		;[admin, manager, user1, user2, user3] = await ethers.getSigners()

		// deploy fake ERC721
		const ERC721Test = await ethers.getContractFactory("ERC721Test")
		nft = (await ERC721Test.deploy().then((c) => c.deployed())) as ERC721Test
		expect(nft.address).to.have.properAddress
	})

	describe("Mints", () => {
		it("single user in whitelist", async () => {
			const quantity = 1
			const proofs = await deployWhitelistedMinter([user1], quantity)
			await expect(
				minter
					.connect(user1)
					.mint(user1.address, quantity, quantity, user1.address, proofs[0], { value: price.mul(quantity) })
			)
				.to.emit(nft, "Transfer")
				.withArgs(ethers.constants.AddressZero, user1.address, anyUint)
		})

		it("single user can't reuse proof", async () => {
			const quantity = 1
			const proofs = await deployWhitelistedMinter([user1], quantity)
			await expect(
				minter
					.connect(user1)
					.mint(user1.address, quantity, quantity, user1.address, proofs[0], { value: price.mul(quantity) })
			)
				.to.emit(nft, "Transfer")
				.withArgs(ethers.constants.AddressZero, user1.address, anyUint)
			await expect(
				minter
					.connect(user1)
					.mint(user1.address, quantity, quantity, user1.address, proofs[0], { value: price.mul(quantity) })
			).to.be.revertedWith("Too many mints")
		})

		it("max user mintable at once", async () => {
			const quantity = 3
			const proofs = await deployWhitelistedMinter([user1, user2], quantity)
			await expect(
				minter
					.connect(user1)
					.mint(user1.address, quantity, quantity, user1.address, proofs[0], { value: price.mul(quantity) })
			)
				.to.emit(nft, "Transfer")
				.withArgs(ethers.constants.AddressZero, user1.address, anyUint)
			await expect(
				minter
					.connect(user2)
					.mint(user2.address, quantity, quantity, user2.address, proofs[1], { value: price.mul(quantity) })
			)
				.to.emit(nft, "Transfer")
				.withArgs(ethers.constants.AddressZero, user2.address, anyUint)
		})

		it("only 1 while user max mintable is greater", async () => {
			const quantity = 3
			const proofs = await deployWhitelistedMinter([user1, user2], quantity)
			await expect(minter.connect(user1).mint(user1.address, 1, quantity, user1.address, proofs[0], { value: price }))
				.to.emit(nft, "Transfer")
				.withArgs(ethers.constants.AddressZero, user1.address, anyUint)
			await expect(minter.connect(user2).mint(user2.address, 1, quantity, user2.address, proofs[1], { value: price }))
				.to.emit(nft, "Transfer")
				.withArgs(ethers.constants.AddressZero, user2.address, anyUint)
		})

		it("can't mint more than user max", async () => {
			const quantity = 2
			const proofs = await deployWhitelistedMinter([user1, user2], quantity)
			await expect(
				minter
					.connect(user1)
					.mint(user1.address, quantity + 1, quantity, user1.address, proofs[0], { value: price.mul(quantity) })
			).to.revertedWith("Too many mints")
			await expect(
				minter
					.connect(user2)
					.mint(user2.address, quantity + 1, quantity, user2.address, proofs[1], { value: price.mul(quantity) })
			).to.revertedWith("Too many mints")
		})

		it("whitelist can include user twice", async () => {
			// tag::merkle-tree-computation-example[]
			// compute merkle tree with user1 in the whitelist twice with different quantities
			const leaves: LeafSourceObject[] = [
				{ address: user1.address, quantity: 1, nonce: 123 },
				{ address: user1.address, quantity: 2, nonce: 456 },
			]
			// end::merkle-tree-computation-example[]
			const proofs = await deployMinterWithLeaves(leaves)

			// user mints using the first proof
			// tag::merkle-tree-mint-example[]
			const tx = await minter.connect(user1).mint(
				user1.address, // <1>
				1, // <2>
				1, // <3>
				123, // <4>
				proofs[0], // <5>
				{ value: price } // <6>
			)
			// end::merkle-tree-mint-example[]
			await expect(tx)
				.to.emit(nft, "Transfer")
				.withArgs(ethers.constants.AddressZero, user1.address, anyUint)

			// user mints using the second proof
			await expect(minter.connect(user1).mint(user1.address, 2, 2, 456, proofs[1], { value: price.mul(2) }))
				.to.emit(nft, "Transfer")
				.withArgs(ethers.constants.AddressZero, user1.address, anyUint)

			// user should have 3 NFTs in total
			expect(await nft.balanceOf(user1.address)).to.equal(3)
		})
	})

	it("checks merkle tree proofs", async () => {
		const proofs = await deployWhitelistedMinter([user1, user2])
		await expect(
			minter.connect(user3).mint(user3.address, 1, 1, user3.address, proofs[0], { value: price })
		).to.be.revertedWith("Invalid merkle proof")
	})

	it("checks purchase price", async () => {
		const proofs = await deployWhitelistedMinter([user1, user2])
		await expect(minter.mint(user1.address, 1, 1, user1.address, proofs[0])).to.be.revertedWith("Wrong purchase amount")
	})

	describe("Collects mint purchases funds", () => {
		it("accepts from manager", async () => {
			const quantity = 3
			const proofs = await deployWhitelistedMinter([user1, user2], quantity)
			await minter
				.connect(user1)
				.mint(user1.address, quantity, quantity, user1.address, proofs[0], { value: price.mul(quantity) })
			await minter
				.connect(user2)
				.mint(user2.address, quantity, quantity, user2.address, proofs[1], { value: price.mul(quantity) })

			const expectedCollectedFunds = price.mul(quantity * 2)
			expect(await minter.payments(manager.address)).to.equal(expectedCollectedFunds)

			await expect(minter.connect(manager).withdrawPayments(manager.address)).to.changeEtherBalance(
				manager,
				expectedCollectedFunds
			)
		})

		it("rejects from anyone but manager", async () => {
			const quantity = 3
			const proofs = await deployWhitelistedMinter([user1, user2], quantity)
			await minter
				.connect(user1)
				.mint(user1.address, quantity, quantity, user1.address, proofs[0], { value: price.mul(quantity) })
			await minter
				.connect(user2)
				.mint(user2.address, quantity, quantity, user2.address, proofs[1], { value: price.mul(quantity) })

			await expect(minter.connect(user1).withdrawPayments(manager.address)).to.be.revertedWith(
				"Ownable: caller is not the owner"
			)

			await expect(minter.connect(manager).withdrawPayments(user1.address)).to.changeEtherBalance(manager, 0)
		})
	})

	async function deployWhitelistedMinter(
		whitelistedUsers: SignerWithAddress[],
		quantityPerUser = 1
	): Promise<string[][]> {
		// compute merkle tree
		const leaves: LeafSourceObject[] = whitelistedUsers.map((user) => {
			return { address: user.address, quantity: quantityPerUser, nonce: user.address }
		})
		return deployMinterWithLeaves(leaves)
	}

	async function deployMinterWithLeaves(leaves: LeafSourceObject[]): Promise<string[][]> {
		// tag::merkle-tree-leaves[]
		const leafSignature: LeafSignature = [
			{ type: "address", name: "address" }, // <1>
			{ type: "uint256", name: "quantity" }, // <2>
			{ type: "uint256", name: "nonce" }, // <3>
		]
		// end::merkle-tree-leaves[]
		// tag::merkle-tree-computation[]
		// compute merkle tree
		const merkleTree = new WMerkleTree(leaves, leafSignature)
		const merkleRoot = merkleTree.getHexRoot()
		// end::merkle-tree-computation[]

		// deploy minter contract
		const Minter = (await ethers.getContractFactory("ERC721MerkleTreeMinter")) as ERC721MerkleTreeMinter__factory
		minter = (await Minter.deploy(manager.address, nft.address, price, merkleRoot).then((c) =>
			c.deployed()
		)) as ERC721MerkleTreeMinter

		// allow minter to mint
		await nft.grantRole(await nft.MINTER_ROLE(), minter.address)

		// tag::merkle-tree-computation[]
		// return user merkle tree proofs for each leaf
		return leaves.map((leaf, index) => merkleTree.getHexProof(index))
		// end::merkle-tree-computation[]
	}
})
