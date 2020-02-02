import mongoose, { Schema, Document } from "mongoose";

export interface DBQuote extends Document {
    date:number;
    number:number;
    quote:string;
}

const QuoteSchema:Schema = new Schema({
    date  : { type:Number, required:true },
    number: { type:Number, require:true, unique:true },
    quote : { type:String, required:true },
});

export default mongoose.model<DBQuote>("Quote", QuoteSchema, "quotes");
