import mongoose from "mongoose";

async function connectDB() {
    if (!process.env.DB_URL) {
        throw new Error("there is some DB issue in env");
    }

    await mongoose
    .connect(process.env.DB_URL)
    .then(()=>console.log("MongoDB is Connected"))
    .catch((err)=>console.log(`MongoDB connection error: ${err}`))
}

export default connectDB