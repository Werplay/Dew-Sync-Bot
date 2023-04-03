import mongoose from 'mongoose';
const cohortSchema = new mongoose.Schema(
  {
    name: { type: String, index: true, sparse: true },
    id: { type: Number, unique: true, index: true },
    admin: { type: String, index: true, sparse: true },
    adminName: { type: String, default: null },
    blockLastSynced: { type: Number, default: 0, index: true },
    merkleRoot: { type: String, default: '' },
    exists: { type: Boolean, default: false },
  },
  { strict: false },
);

export default mongoose.model('cohorts', cohortSchema);
