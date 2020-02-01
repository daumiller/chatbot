import mongoose, { Schema, Document } from "mongoose";

export interface DBCommand extends Document {
    name:string;
    permission:number;
    permission_edit?:number;
    chat_enabled:boolean;
    whisper_enabled:boolean;
    cooldown_seconds?:number;
    handled_by?:string;
    template?:string;
    counter?:number;
    filename?:string;
}

const CommandSchema:Schema = new Schema({
    name:             { type:String, required:true, unique:true },
    permission:       { type:Number, required:true },
    permission_edit:  { type:Number },
    chat_enabled:     { type:Boolean, required:true },
    whisper_enabled:  { type:Boolean, required:true },
    cooldown_seconds: { type:Number },
    handled_by:       { type:String },
    template:         { type:String },
    counter:          { type:Number },
    filename:         { type:String },
});

export default mongoose.model<DBCommand>("Command", CommandSchema, "commands");
