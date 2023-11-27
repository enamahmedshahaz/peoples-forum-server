const express = require('express');
const app = express();

const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT || 5000;

//middleware 
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bmgmcoi.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // Get the database and collection on which to run the operation
    const database = client.db("PeoplesForumDB");
    const postCollection = database.collection("posts");


    // API to get all posts
    app.get('/posts', async (req, res) => {

      const sortQuery = req.query.sort;
      let result;

      if (sortQuery === '1') {
        const pipeline =
          [
            {
              $addFields: { voteDifference: { $subtract: ["$upVote", "$downVote"] } }
            },
            {
              $sort: { voteDifference: -1 }
            }
          ];
        result = await postCollection.aggregate(pipeline).toArray();
      } else {
        result = await postCollection.find().toArray();
      }
      res.send(result);

    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //  await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send('::peoples-forum:: server is running...');
});

app.listen(port, () => {
  console.log(`peoples-forum server is running on port ${port}...`);
});