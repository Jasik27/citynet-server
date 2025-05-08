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

        // PATCH: Mark a subscription as paid
        app.patch('/subscriptions/:id/payment', async (req, res) => {
            const { id } = req.params;
            try {
                const result = await subscriptionCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { paymentStatus: "paid", paymentDate: new Date() } }
                );
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Payment update failed" });
            }
        });


        // Admin Privileges 

        // GET user by email
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });
            res.send(user);
        });

        // GET user by email
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });
            res.send(user);
        });

        // Manage users

        // Get all users
        app.get("/admin/users", async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        // Update user info
        app.patch("/admin/users/:email", async (req, res) => {
            const { email } = req.params;
            const updates = req.body;
            const result = await userCollection.updateOne({ email }, { $set: updates });
            res.send(result);
        });

        // Change role
        app.patch("/admin/users/role/:email", async (req, res) => {
            const { email } = req.params;
            const { role } = req.body;
            const result = await userCollection.updateOne({ email }, { $set: { role } });
            res.send(result);
        });

        // Delete user
        app.delete("/admin/users/:email", async (req, res) => {
            const { email } = req.params;
            const result = await userCollection.deleteOne({ email });
            res.send(result);
        });

        // Add a new package
        app.post('/packages', async (req, res) => {
            try {
                const data = req.body;
                if (!data.name || !data.planId || !data.price || !data.speed) {
                    return res.status(400).send({ error: "Missing required fields" });
                }
                const result = await packageCollection.insertOne(data);
                res.status(201).send(result);
            } catch (error) {
                console.error("Error adding package:", error);
                res.status(500).send({ error: "Failed to add package" });
            }
        });

        // Delete a package
        app.delete('/packages/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const result = await packageCollection.deleteOne({ _id: new ObjectId(id) });
                res.send(result);
            } catch (error) {
                console.error("Error deleting package:", error);
                res.status(500).send({ error: "Failed to delete package" });
            }
        });

        // PATCH: Update an existing package by _id
        app.patch("/packages/:id", async (req, res) => {
            const { id } = req.params;
            let updates = req.body;

            // Exclude _id from updates if it exists
            if (updates._id) {
                delete updates._id;
            }

            try {
                const result = await packageCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updates }
                );
                res.send(result);
            } catch (error) {
                console.error("Update failed:", error);
                res.status(500).send({ message: "Failed to update package" });
            }
        });



        // GET all support requests (for Admin)
        app.get('/support-requests', async (req, res) => {
            try {
                const requests = await supportCollection.find().sort({ createdAt: -1 }).toArray();
                res.send(requests);
            } catch (error) {
                res.status(500).send({ error: "Failed to fetch support requests." });
            }
        });

        // PUT update support request status + optional adminComments
        app.put('/support-requests/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { status, adminComments } = req.body;

                if (!status) {
                    return res.status(400).send({ error: "Status is required" });
                }

                const updateData = {
                    status,
                    lastUpdated: new Date()
                };

                if (status === "solved" && adminComments) {
                    updateData.adminComments = adminComments;
                }

                const result = await supportCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );

                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: "Failed to update support request." });
            }
        });


        // -----------
         // Get all subscriptions (Admin View)
        app.get('/subscriptions', async (req, res) => {
            try {
                const result = await subscriptionCollection.find().sort({ subscriptionDate: -1 }).toArray();
                res.send(result);
            } catch (error) {
                console.error("Error fetching subscriptions:", error);
                res.status(500).send({ message: "Failed to retrieve subscriptions" });
            }
        });

        // Update subscription status (Admin View)
        app.patch('/subscriptions/:id', async (req, res) => {
            const { id } = req.params;
            const updates = req.body;

            try {
                const result = await subscriptionCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updates }
                );
                res.send(result);
            } catch (err) {
                console.error("Failed to update subscription:", err);
                res.status(500).send({ message: "Update failed" });
            }
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
