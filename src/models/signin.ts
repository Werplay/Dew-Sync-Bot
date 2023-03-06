import mongoose from "mongoose";

const SigningRequest = new mongoose.Schema({

  address: { type :String, index: true, required: true },
  nonce:  { type : String , index: true, required: true, unique: true },
  status: { type: String, index: true, required: true, default: 'requested' },
  tokenUsed: { type: Number, required: true, default: 0 },
  ipAddress: String,
  userAgent: {type : String,  required: false },
  walletProvider: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { strict: true });


export default mongoose.model("signin", SigningRequest);