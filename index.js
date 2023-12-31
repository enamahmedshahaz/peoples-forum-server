const express = require('express');
const app = express();

const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');


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
    // await client.connect();

    // Get the database and collection on which to run the operation
    const database = client.db("PeoplesForumDB");
    const userCollection = database.collection("users");
    const postCollection = database.collection("posts");
    const commentCollection = database.collection("comments");
    const reportCollection = database.collection("reports");
    const announcementCollection = database.collection("announcements");


    //middlewares
    const verifyToken = (req, res, next) => {
      console.log('Inside verify token: ', req.headers.authorization);
      //no authorization header
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      //if has authorization header, extract token from header and verify it
      const token = req.headers.authorization.split(' ')[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        // token is not valid
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        //token is valid
        req.decoded = decoded;
        next();
      })
    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }



    //jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    //API to check if a email is admin user
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }


      const query = { email: email };
      const user = await userCollection.findOne(query);

      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });

    });


    // API to insert users data
    app.post('/users', async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //API to get a user info based on email
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    //API to get all users
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    //API to make a user admin
    app.patch('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          role: 'admin',
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


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
            },
            {
              $lookup: {
                from: 'comments',
                localField: '_id',
                foreignField: 'postId',
                as: 'comments',
              },
            },
            {
              $project: {
                _id: 1,
                authorName: 1,
                authorEmail: 1,
                authorImage: 1,
                title: 1,
                description: 1,
                tags: 1,
                createdAt: 1,
                upVote: 1,
                downVote: 1,
                voteDifference: 1,
                latest: 1,
                commentCount: { $size: '$comments' },
              },
            },

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
            },
            {
              $lookup: {
                from: 'comments',
                localField: '_id',
                foreignField: 'postId',
                as: 'comments',
              },
            },
            {
              $project: {
                _id: 1,
                authorName: 1,
                authorEmail: 1,
                authorImage: 1,
                title: 1,
                description: 1,
                tags: 1,
                createdAt: 1,
                upVote: 1,
                downVote: 1,
                voteDifference: 1,
                latest: 1,
                commentCount: { $size: '$comments' },
              },
            }
          ];
        result = await postCollection.aggregate(pipeline).toArray();
      }
      res.send(result);
    });


    //a sample api to test server
    app.get('/sample', async (req, res) => {
      const pipeline =
        [
          {
            $lookup: {
              from: 'comments',
              localField: '_id',
              foreignField: 'postId',
              as: 'comments',
            },
          },
          {
            $project: {
              _id: 1,
              title: 1,
              description: 1,
              commentCount: { $size: '$comments' },
            },
          }
        ];
      result = await postCollection.aggregate(pipeline).toArray();
      res.send(result);
    });


    //API to get latest posts of a user and limit data by count 
    app.get('/posts/latest', verifyToken, async (req, res) => {
      const email = req.query.email;
      const count = parseInt(req.query.count);

      const query = { authorEmail: email };

      const pipeline =
        [
          { $match: query },
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
          },
          {
            $limit: count
          },

        ];
      result = await postCollection.aggregate(pipeline).toArray();

      res.send(result);
    });


    //API to get a post based on user email
    app.get('/posts/email/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { authorEmail: email };

      const pipeline =
        [
          { $match: query },
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
          },
          {
            $lookup: {
              from: 'comments',
              localField: '_id',
              foreignField: 'postId',
              as: 'comments',
            },
          },
          {
            $project: {
              _id: 1,
              authorName: 1,
              authorEmail: 1,
              authorImage: 1,
              title: 1,
              description: 1,
              tags: 1,
              createdAt: 1,
              upVote: 1,
              downVote: 1,
              voteDifference: 1,
              latest: 1,
              commentCount: { $size: '$comments' },
            },
          }
        ];
      result = await postCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    //API to delete post based on post id 
    app.delete('/posts/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postCollection.deleteOne(query);
      res.send(result);
    });


    //API to get a post based on post id
    app.get('/posts/id/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postCollection.findOne(query);
      res.send(result);
    });

    // API to increment upvote field of a  post based on id
    app.patch('/posts/incrementUpVote/:id', verifyToken, async (req, res) => {
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
    app.patch('/posts/incrementDownVote/:id', verifyToken, async (req, res) => {
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

    // API to insert a new post
    app.post('/posts', verifyToken, async (req, res) => {
      const post = req.body;
      const result = await postCollection.insertOne(post);
      res.send(result);
    });

    // API to insert a comment
    app.post('/comments', verifyToken, async (req, res) => {
      const comment = req.body;
      const postIdString = comment.postId;
      const modifiedComment = {...comment, postId: new ObjectId(postIdString)};
      console.log('comment to insert: ', modifiedComment);
      const result = await commentCollection.insertOne(modifiedComment);
      res.send(result);
    });

    //API to get a comments based on post Id
    app.get('/comments/:postId', async (req, res) => {
      const postId = req.params.postId;
      const query = { postId: new ObjectId(postId) };
      const result = await commentCollection.find(query).toArray();
      res.send(result);
    });


    // API to insert a report
    app.post('/reports', verifyToken, async (req, res) => {
      const report = req.body;
      const result = await reportCollection.insertOne(report);
      res.send(result);
    });

    // API to get all reports
    app.get('/reports', verifyToken, verifyAdmin, async (req, res) => {
      const result = await reportCollection.find().toArray();
      res.send(result);
    });

    // API to delete a report and associated comment
    app.delete('/reports/:id', verifyToken, verifyAdmin, async (req, res) => {
      const reportId = req.params.id;

      const foundReport = await reportCollection.findOne({ _id: new ObjectId(reportId) }, { commentId: 1 });
      const associatedCommentId = foundReport.commentId;

      // Start a transaction
      const session = client.startSession();
      session.startTransaction();

      await reportCollection.deleteOne({ _id: new ObjectId(reportId) });
      const result =
        await commentCollection.deleteOne({ _id: new ObjectId(associatedCommentId) });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      res.send(result);
    });

    // API to insert a announcement
    app.post('/announcements', verifyToken, verifyAdmin, async (req, res) => {
      const announcement = req.body;
      const result = await announcementCollection.insertOne(announcement);
      res.send(result);
    });

    // API to get all announcements (get latest first)
    app.get('/announcements', async (req, res) => {
      const options = {
        sort: { createdAt: -1 },
      };
      const result = await announcementCollection.find({}, options).toArray();
      res.send(result);
    });

    // API to get site stats or analytics
    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {

      const users = await userCollection.estimatedDocumentCount();
      const posts = await postCollection.estimatedDocumentCount();
      const comments = await commentCollection.estimatedDocumentCount();

      res.send({ users, posts, comments });

    });


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
   // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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