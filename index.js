const express = require("express");
const app = express();
const cors = require("cors");
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// connection
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.dfqi0xb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });

        const db = client.db("cityNetISP");
        const packageCollection = db.collection("packages");
        const reviewCollection = db.collection("reviews");
        const userCollection = db.collection("users");
        const subscriptionCollection = db.collection("userplans");
        const supportCollection = db.collection("supportRequests");

        // Get all packages
        app.get('/packages', async (req, res) => {
            const result = await packageCollection.find().toArray();
            res.send(result);
        });

        // Get all reviews
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        });

        // Save user to MongoDB
        app.post('/users', async (req, res) => {
            const user = req.body;
            const existingUser = await userCollection.findOne({ email: user.email });
            if (existingUser) {
                return res.status(409).send({ message: 'User already exists.' });
            }
            const result = await userCollection.insertOne(user);
            res.status(201).send(result);
        });

        // Check for duplicate subscription
        app.get('/subscriptions/check', async (req, res) => {
            const { userId, planId } = req.query;
            if (!userId || !planId) {
                return res.status(400).send({ message: "Missing userId or planId" });
            }

            const existing = await subscriptionCollection.findOne({ userId, planId });
            if (existing) {
                return res.send({ exists: true });
            }
            res.send({ exists: false });
        });

        // Save subscription to userplans collection
        app.post('/subscriptions', async (req, res) => {
            const subscription = req.body;
            if (!subscription || !subscription.userId || !subscription.planId) {
                return res.status(400).send({ message: "Missing required subscription fields." });
            }

            subscription.subscriptionDate = new Date();
            subscription.status = "active";
            subscription.lastUpdated = new Date();

            const result = await subscriptionCollection.insertOne(subscription);
            res.status(201).send(result);
        });

        // Optional: get subscriptions for a user
        app.get('/subscriptions/:userId', async (req, res) => {
            const { userId } = req.params;
            const result = await subscriptionCollection.find({ userId }).toArray();
            res.send(result);
        });

        // PATCH: Disable a subscription
        app.patch('/subscriptions/:id', async (req, res) => {
            const { id } = req.params;
            const updates = req.body;
            try {
                const result = await subscriptionCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updates }
                );
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Failed to update subscription" });
            }
        });

        // Submit support request or complaint
        app.post("/support-requests", async (req, res) => {
            const data = req.body;
            if (!data?.name || !data?.email || !data?.supportMessage || !data?.type) {
                return res.status(400).send({ error: "Missing required fields." });
            }

            try {
                const result = await supportCollection.insertOne(data);
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: "Failed to submit request" });
            }
        });

        // Get all service requests for a specific user
        // GET: Fetch all support requests by userId
        app.get("/support-requests/user/:userId", async (req, res) => {
            const { userId } = req.params;
            try {
                const requests = await supportCollection
                    .find({ userId })
                    .sort({ createdAt: -1 })
                    .toArray();
                res.send(requests);
            } catch (err) {
                console.error(err);
                res.status(500).send({ message: "Failed to fetch support requests." });
            }
        });

        // Admin Privileges 

        // GET user by email
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });
            res.send(user);
        });

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('I am cominggggggg');
});

app.listen(port, () => {
    console.log(`City net is running on port ${port}`);
});
