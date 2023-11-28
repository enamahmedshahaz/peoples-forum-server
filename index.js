const express = require('express');
const app = express();

const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT || 5000;

//middleware 
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const commentCollection = database.collection("comments");


    // API to get all tags (sorted)
    app.get('/tags', async (req, res) => {

      const result = await postCollection.aggregate([
        { $unwind: "$tags" },
        {
          $group: {
            _id: null,
            tags: { $addToSet: "$tags" }
          }
        }
      ]).toArray();

      res.send(result[0].tags.sort());
    });

    // API to get all posts
    app.get('/posts', async (req, res) => {

      const sortQuery = req.query.sort;
      let result;

      if (sortQuery === '1') {
        const pipeline =
          [
            {
              $addFields: {
                voteDifference: { $subtract: ["$upVote", "$downVote"] },
                latest: {
                  $cond: {
                    if: { $gt: ['$createdAt', '$updatedAt'] },
                    then: '$createdAt',
                    else: '$updatedAt'
                  }
                },
              }
            },
            {
              $sort: { voteDifference: -1, latest: -1 }
            }
          ];
        result = await postCollection.aggregate(pipeline).toArray();
      } else {
        const pipeline =
          [
            {
              $addFields: {
                voteDifference: { $subtract: ["$upVote", "$downVote"] },
                latest: {
                  $cond: {
                    if: { $gt: ['$createdAt', '$updatedAt'] },
                    then: '$createdAt',
                    else: '$updatedAt'
                  }
                },
              }
            },
            {
              $sort: { latest: -1 }
            }
          ];
        result = await postCollection.aggregate(pipeline).toArray();
      }
      res.send(result);
    });


    //API to get a post based on id
    app.get('/posts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postCollection.findOne(query);
      res.send(result);
    });

    // API to increment upvote field of a  post based on id
    app.patch('/posts/incrementUpVote/:id', async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: { upVote: 1 }
      };
      const updateResult = await postCollection.updateOne(filter, updateDoc);
      const findResult = await postCollection.findOne(filter);

      const updatedUpVote = findResult.upVote;

      res.send({ ...updateResult, updatedUpVote });
    });

    // API to increment downvote field of  post based on id
    app.patch('/posts/incrementDownVote/:id', async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: { downVote: 1 }
      };
      const updateResult = await postCollection.updateOne(filter, updateDoc);
      const findResult = await postCollection.findOne(filter);

      const updatedDownVote = findResult.downVote;

      res.send({ ...updateResult, updatedDownVote });
    });

    // API to insert a comment
    app.post('/comments', async (req, res) => {
      const comment = req.body;
      const result = await commentCollection.insertOne(comment);
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