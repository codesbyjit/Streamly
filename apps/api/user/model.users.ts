import mongoose from "mongoose";
import bcrypt from "bcrypt"

interface IUser {
    username: string,
    email: string,
    password: string
}

const userSchema = new mongoose.Schema<IUser>({
    username: {type: String, required: true},
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true},
})

userSchema.pre("save", async function () {
    if(!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);  
})

export default mongoose.model('User', userSchema)