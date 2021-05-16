const config = require("../config/config");
const cron = require("node-cron");
const axios = require("axios").default;
const utils = require("./utils")
var fs = require('fs');
const Web3 = require('web3');
const MetaNetwork = require('@maticnetwork/meta/network')

const network = new MetaNetwork(
    config.matic.deployment.network,
    config.matic.deployment.version,
)

const { abi } = require("./abi")
const provider = new Web3.providers.HttpProvider(network.Matic.RPC)
const web3 = new Web3(provider)

// connect to firebase 
var admin = require("firebase-admin");
var serviceAccount = require("../serviceAccountKeyMainnet.json"); 
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();
let errorMappings = [];
let updatedMappings = [];


// update POS mappings in firebase
async function updatePosMapping(mapping){
    try{

        // get name, decimal, symbol of tokens
        let tokenDetails = await utils.getTokenDetails('pos', mapping)
        if(tokenDetails && tokenDetails.tokenName && tokenDetails.tokenSymbol && tokenDetails.tokenDecimal){
            let address = null
            if(network.Matic.ChainId === "137"){
                address = {
                    "1" : mapping.rootToken,
                    "137" : mapping.childToken
                }
            } else {
                address = {
                    "5" : mapping.rootToken,
                    "80001" : mapping.childToken
                }
            }
            let id = utils.uuidv4();
            let data = {
                addresses: address,
                decimals: parseInt(tokenDetails.tokenDecimal),
                id: id,
                isPoS: true,
                isMetaTx: true,
                name: tokenDetails.tokenName,
                symbol: tokenDetails.tokenSymbol,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }
            console.log(data)
            // update in firebase
            await db.collection('posERC20TokenList').doc(id).set(data).then(()=> {
                console.log("updated in firebase")
            })
            updatedMappings.push({data, "---": "-----------"})
        } else {
            errorMappings.push({
                "rootToken": tokenDetails.rootToken, 
                "childToken": tokenDetails.childToken, 
                "isPos": tokenDetails.isPOS, 
                "---": "---------------"
            })
        }
    } catch (err){
        console.log(err)
    }
}

// update PLASMA mappings in firebase
async function updatePlasmaMapping(mapping){
    try{
        // get name, decimal, symbol of tokens
        let tokenDetails = await utils.getTokenDetails('plasma', mapping)
        if(tokenDetails && tokenDetails.tokenName && tokenDetails.tokenSymbol && tokenDetails.tokenDecimal){
            let address = null
            if(network.Matic.ChainId === "137"){
                address = {
                    "1" : mapping.rootToken,
                    "137" : mapping.childToken
                }
            } else {
                address = {
                    "5" : mapping.rootToken,
                    "80001" : mapping.childToken
                }
            }
            let id = utils.uuidv4();
            let data = {
                addresses: address,
                decimals: parseInt(tokenDetails.tokenDecimal),
                id: id,
                isMetaTx: false,
                name: tokenDetails.tokenName,
                symbol: tokenDetails.tokenSymbol,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }
            // // update in firebase
            await db.collection('erc20TokenList').doc(id).set(data).then(()=> {
                console.log("updated in firebase")
            })
            updatedMappings.push(data)
        } else {
            errorMappings.push({
                "rootToken": tokenDetails.rootToken, 
                "childToken": tokenDetails.childToken, 
                "isPos": tokenDetails.isPOS, 
                "---": "---------------"
            })
        }
    } catch (err){
        console.log(err)
    }
}

// check for all mappings if present in firebase database
async function mappingCheck(mappings) {
    try {
        for (const mapping of mappings) {

            //check if it pos or plasma
            try {
                if(mapping.isPOS){
                    let collection = await db.collection('posERC20TokenList').get()
                    let foundMapping = collection.docs.find((doc) => 
                        doc.data().addresses[network.Main.ChainId].toLowerCase() === mapping.rootToken.toLowerCase()
                    );
                    if(!foundMapping){
                        //add to firebase
                        await updatePosMapping(mapping);
                    }
                } else {
                    let collection = await db.collection('erc20TokenList').get()
                    let foundMapping = collection.docs.find((doc) => 
                        doc.data().addresses[network.Main.ChainId].toLowerCase() === mapping.rootToken.toLowerCase()
                    );
                    if(!foundMapping){
                        //add to firebase
                        await updatePlasmaMapping(mapping);
                    } 
                }
            } catch (err) {
                console.log(err)
            }
        }
    } catch (err) {
        console.log(err)
    }
    
}

// get all the mappings from subgraph API
async function getMappings() {
    try {
        let mappings = await axios.post(config.SUBGRAPH_URL, {"query":"{ tokenMappings(first:1000, orderBy: timestamp, orderDirection: desc) { id rootToken childToken tokenType isPOS timestamp transactionHash }}","variables":null})
        if(mappings.status === 200){
            return mappings.data.data.tokenMappings
        }
        else {
            return null
        }
    } catch(err) {
        throw new Error("INTERNAL_SERVER_ERROR");
    }
}

async function notifyAdmin(params) {
    var datetime = new Date();
    await axios.post("https://hooks.slack.com/services/" + config.SLACK_KEY, {
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "FireBase token Mapper",
                },
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "Time: " + datetime,
                },
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "updated Mappings: " + params.updated,
                },
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "error Mappings: " + params.errored,
                },
            },
        ],
    });
}

/* This will schedule the script for every 6 hours 
update the firebase if got new mapping from firebase */
// cron.schedule("*/59 59 5 * * *", async function () {
//     try {
//         errorMappings = [];
//         updatedMappings = [];
//         let mappings = await getMappings()
//         if(mappings) {
//             let allERC20Mappings = mappings
//                 .filter(mapping => mapping.tokenType === config.erc20TokenType)
//             await mappingCheck(allERC20Mappings);
//         }
//         let updated = JSON.stringify(updatedMappings)
//         let errored = JSON.stringify(errMappings)
//         await notifyAdmin({updated, errored})

//     } catch (err) {
//         console.log(err)
//     }
// });

async function temporaryScript(){
    let mappings = await db.collection('posERC20TokenList').get()

    for (let i = 0; i < mappings.docs.length; i++){
        let a = mappings.docs[i].data()
        if(a.isMetaTx === false){
            //console.log(a)
            continue;
        }

        let data = {
            isMetaTx: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }
        db.collection('posERC20TokenList').doc(a.id).update(data).then(()=> {
            console.log("updated in firebase")
        })
        
        // const data = await web3.eth.abi.encodeFunctionCall(
        //     {
        //         name: 'getNonce',
        //         type: 'function',
        //         inputs: [
        //         {
        //             name: 'user',
        //             type: 'address',
        //         },
        //         ],
        //     },
        //     ["0xFd71Dc9721d9ddCF0480A582927c3dCd42f3064C"],
        // )

        // await web3.eth.call({
        //     to: a.addresses['137'],
        //     data,
        // }).then(d => {
            
            
        // }).catch(err => {
        //     let data = {
        //         isMetaTx: false,
        //         updatedAt: admin.firestore.FieldValue.serverTimestamp()
        //     }
        //     console.log(a.id)
        //     console.log(data)
        //     db.collection('posERC20TokenList').doc(a.id).update(data).then(()=> {
        //         console.log("updated in firebase")
        //     })
        // })

        
    }
    
}

temporaryScript();

// async function updateInBiconomy(){
//     let mappings = await db.collection('posERC20TokenList').get()
//     for (let i = 0; i < mappings.docs.length; i++){
//         let a = mappings.docs[i].data()
//         if(a.isMetaTx === false){
//             // console.log(a.id)
//             // const data = await web3.eth.abi.encodeFunctionCall(
//             //     {
//             //         name: 'getNonce',
//             //         type: 'function',
//             //         inputs: [
//             //         {
//             //             name: 'user',
//             //             type: 'address',
//             //         },
//             //         ],
//             //     },
//             //     ["0xFd71Dc9721d9ddCF0480A582927c3dCd42f3064C"],
//             // )

//             // await web3.eth.call({
//             //     to: a.addresses['137'],
//             //     data,
//             // }).then(d => {
//             //     let data = {
//             //         isMetaTx: true,
//             //         updatedAt: admin.firestore.FieldValue.serverTimestamp()
//             //     }
//             //     console.log(a.id)
//             //     console.log(data)
//             //     db.collection('posERC20TokenList').doc(a.id).update(data).then(()=> {
//             //         console.log("updated in firebase")
//             //     })
                
                
//             // }).catch(err => {
                
//             // })
            
//         }

//         else {
//             let url = "https://api.biconomy.io/api/v1/smart-contract/public-api/addContract";
//             let body = {
//                 "contractName" : a.name,
//                 "contractAddress" : a.addresses['137'],
//                 "abi" : JSON.stringify(abi),
//                 "contractType" : "SC",
//                 "metaTransactionType": "DEFAULT"
//             }
//             let response = await utils.apiCall({url, body})
//             // console.log("addcontract", response)
//             // console.log(a.name.concat("_executeMetaTx"))
//             if(response.code === 200){
//                 console.log("aaaa")
//                 let url2 = "https://api.biconomy.io/api/v1/meta-api/public-api/addMethod";
//                 let body1 = {
//                     "apiType": "native",
//                     "methodType": "write",
//                     "name": a.name.concat("_executeMetaTx"),
//                     "contractAddress": a.addresses['137'],
//                     "method": "executeMetaTransaction"
//                 }
//                 let addMethod = await utils.apiCall({url: url2, body: body1})
//                 //console.log("addmethod", addMethod)
//                 if(addMethod.code === 200){
//                     console.log('bbb')
//                 } else {
//                     // console.log(a.name, a.id)
//                 }
//             }else {
//                 // console.log(a.name, a.id)
//             }
//         }
        
//     }
    
// }

// updateInBiconomy();
