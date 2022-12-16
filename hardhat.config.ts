import "dotenv/config";
import { HardhatUserConfig, task, types } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "hardhat-contract-sizer";
import "hardhat-deploy";

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 5000,
          },
        },
      },
    ],
  },
  networks: {
    mumbai: {
      url: process.env.MUMBAI_URL || "https://matic-mumbai.chainstacklabs.com",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    polygon: {
      url: process.env.MATIC_URL || "https://polygon-rpc.com",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gasMultiplier: 1.1,
    },
		goerli: {
			url: "https://rpc.ankr.com/eth_goerli",
			accounts:
				process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
			chainId: 5,
			gasMultiplier: 1.3,
		},
  },
  typechain: {
		outDir: 'artifacts/typechain',
		target: 'ethers-v5',
	},
  gasReporter: {
    enabled: (process.env.REPORT_GAS) ? true : false,
  },
	/*
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
    },
  },
	*/
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
