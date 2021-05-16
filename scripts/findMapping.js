
// connect to firebase 
var admin = require("firebase-admin");
var serviceAccount = require("../serviceAccountKeyMainnet.json"); 
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();


async function findMapping(){
    let mappings = await db.collection('posERC20TokenList').get()
    var obj = {
        table: []
    };
    mappings.docs.map(doc=> {
        // if(doc.data()){
        //     if(doc.data().addresses[1].toLowerCase() === "0x1eb754b8355d3185a7429109bde75e473434b26b".toLowerCase()){
        //         obj.table.push(doc.data()) 
        //     }
        // }
        if(doc.data()){
            if(doc.data().symbol.toLowerCase() === "UNI".toLowerCase()){
                obj.table.push(doc.data()) 
            }
        }
    })
    console.log(obj)
    // console.log(obj.table[0].addresses)
}

findMapping()
