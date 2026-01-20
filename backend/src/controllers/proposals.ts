import { Request, Response } from 'express';
import { supabase } from '../services/supabase';

export const getProposals = async (req: Request, res: Response) => {
    const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    return res.json(data);
};

export const createProposal = async (req: Request, res: Response) => {
    const { title, content, user_id } = req.body;
    const { data, error } = await supabase
        .from('proposals')
        .insert([{ title, content, user_id }])
        .select()
        .single();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    return res.status(201).json(data);
};

export const getProposalById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        return res.status(404).json({ error: 'Proposal not found' });
    }
    return res.json(data);
};

export const updateProposal = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, content } = req.body;
    const { data, error } = await supabase
        .from('proposals')
        .update({ title, content, updated_at: new Date() })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    return res.json(data);
};
