const config = require("../config/config");
const Web3 = require('web3');
const MetaNetwork = require('@maticnetwork/meta/network')

const network = new MetaNetwork(
    config.matic.deployment.network,
    config.matic.deployment.version,
)

const provider = new Web3.providers.HttpProvider(network.Matic.RPC)
const web3 = new Web3(provider)
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function getTokenDetails(type, mapping){
    try {
        let abi = null;
        if(type==="plasma"){
            abi = network.abi('ChildERC20', 'plasma')
        } else {
            abi = network.abi('ChildERC20', 'pos')
        }

        const tokenContractInstance = new web3.eth.Contract(
            abi,
            mapping.childToken,
        )

        const tokenName = await tokenContractInstance.methods.name().call()
        const tokenDecimal = await tokenContractInstance.methods.decimals().call()
        const tokenSymbol = await tokenContractInstance.methods.symbol().call()
        let details = {
            tokenName,
            tokenDecimal,
            tokenSymbol
        }
        return details
    } catch (err) {
        //console.log(mapping)
        return mapping
    }
}

module.exports = { getTokenDetails, uuidv4 }