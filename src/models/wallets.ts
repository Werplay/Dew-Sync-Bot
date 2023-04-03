import mongoose from 'mongoose';
const walletSchema = new mongoose.Schema(
  {
    address: { type: String, unique: true, index: true, sparse: true },
    name: { type: String, default: null },
    blockLastSynced: { type: Number, default: 0, index: true, sparse: true },
    balance: { type: String, index: true, sparse: true },
  },
  { strict: true },
);

export default mongoose.model('wallets', walletSchema);
