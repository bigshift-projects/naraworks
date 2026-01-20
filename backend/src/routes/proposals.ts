import { Router } from 'express';
import { getProposals, createProposal, getProposalById, updateProposal } from '../controllers/proposals';

const router = Router();

router.get('/', getProposals);
router.post('/', createProposal);
router.get('/:id', getProposalById);
router.put('/:id', updateProposal);

export default router;
