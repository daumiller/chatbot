import mongoose, { Schema, Document } from "mongoose";

export interface DBGreeting extends Document {
    username:string;
    template:string;
}

const GreetingSchema:Schema = new Schema({
    username: { type:String, required:true, unique:true },
    template: { type:String, required:true },
});

export default mongoose.model<DBGreeting>("Greeting", GreetingSchema, "greetings");;
