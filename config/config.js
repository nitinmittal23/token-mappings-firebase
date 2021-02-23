let path = require("path");
let dotenv = require("dotenv");

// load config env
let root = path.normalize(`${__dirname}/..`);
let fileName = "";

switch (process.env.NODE_ENV) {
  case "production": {
    fileName = "/config-production.env";
    break;
  }
  default:
    fileName = "/.env";
}

const configFile = `${root}${fileName}`;
dotenv.config({ path: configFile, silent: true });

module.exports = {
  SUBGRAPH_URL: process.env.subgraphUrl,
  matic: {
    deployment: {
      network: process.env.DEPLOYMENT_NETWORK || 'mainnet',
      version: process.env.DEPLOYMENT_VERSION || 'v1',
    },
  },
  erc20TokenType: "0x8ae85d849167ff996c04040c44924fd364217285e4cad818292c7ac37c0a345b",
  SLACK_KEY: process.env.SLACK_KEY
};
