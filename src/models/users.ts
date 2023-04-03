import mongoose from 'mongoose'
const userSchema = new mongoose.Schema({
    userName: { type: String, unique: true , index: true,  sparse: true},
    //userId: {type:String , unique: true, index:true},
    wallet_address:{ type: String, unique: true , index: true,  sparse: true},
    emailAddress: { type: String, unique: true , index: true,  sparse: true},
    firstName: {type: String , default: null},
    lastName: {type: String , default: null},
    bio: {type: String , default: null},
    profileImage: {type: String , default: null},
    profileBannerImage: {type: String , default: null},
    links: {type : Array, default: ["","",""]  },
    lastActive: {type: Date , default: Date.now},
    createdAt: { type: Date, default: Date.now },
    updatedAt: {type: Date , default: null},
}, { strict: true });

export default mongoose.model("users", userSchema);