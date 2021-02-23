const config = require("../config/config");
const cron = require("node-cron");
const axios = require("axios").default;
const utils = require("./utils")

const MetaNetwork = require('@maticnetwork/meta/network')

const network = new MetaNetwork(
    config.matic.deployment.network,
    config.matic.deployment.version,
)

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

// getMappings().then(mappings=> {
//     errorMappings = [];
//     updatedMappings = [];
//     let data = mappings
//         .filter(mapping => 
//             mapping.childToken === "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619"
//         )
//     console.log(data)
//     // mappingCheck(data).then(()=> {
//     //     let updated = JSON.stringify(updatedMappings)
//     //     let errored = JSON.stringify(errorMappings)
//     //     console.log(updated)
//     //     console.log(errored)
//     //     //notifyAdmin({updated, errored})
        
//     // })
// })

db.collection('posERC20TokenList').get().then((data)=> {
    data.docs.map(doc=> {
        if(doc.data())
            if(doc.data().symbol == 'CHAIN'){
                console.log(doc.data())
            }
    })
})
