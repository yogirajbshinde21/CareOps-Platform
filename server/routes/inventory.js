// server/routes/inventory.js - Inventory / resource management
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const supabase = require('../config/supabase');
const { sendLowStockAlert } = require('../services/emailService');
const { webhookEvents } = require('../services/webhookService');

router.use(authenticate);

// GET /api/inventory - List all items
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('workspace_id', req.user.workspace_id)
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// GET /api/inventory/alerts - Low-stock items
router.get('/alerts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('workspace_id', req.user.workspace_id)
      .gt('reorder_level', 0); // Only items with a threshold set

    if (error) throw error;

    const alerts = (data || []).filter(item => item.quantity <= item.reorder_level);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// POST /api/inventory - Create item
router.post('/', async (req, res) => {
  try {
    const { name, description, quantity, unit, reorder_level, price } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        workspace_id: req.user.workspace_id,
        name,
        description: description || '',
        quantity: quantity || 0,
        unit: unit || 'units',
        reorder_level: reorder_level || 0,
        price: price || 0
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create item' });
  }

});

// POST /api/inventory/bulk - Bulk create items (for onboarding)
router.post('/bulk', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(200).json([]);

    // Delete existing items first to prevent duplicates on re-run
    await supabase.from('inventory_items').delete().eq('workspace_id', req.user.workspace_id);

    const itemsToInsert = items.map(item => ({
      workspace_id: req.user.workspace_id,
      name: item.name,
      description: item.description || '',
      quantity: parseInt(item.quantity) || 0,
      unit: item.unit || 'units',
      reorder_level: parseInt(item.reorder_level) || 0,
      price: parseInt(item.price) || 0
    }));

    const { data, error } = await supabase
      .from('inventory_items')
      .insert(itemsToInsert)
      .select();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Bulk inventory error:', err);
    res.status(500).json({ error: 'Failed to bulk create items' });
  }
});

// PUT /api/inventory/:id - Update item
router.put('/:id', async (req, res) => {
  try {
    const { name, description, quantity, unit, reorder_level, price } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (quantity !== undefined) updates.quantity = quantity;
    if (unit !== undefined) updates.unit = unit;
    if (reorder_level !== undefined) updates.reorder_level = reorder_level;
    if (price !== undefined) updates.price = price;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('inventory_items')
      .update(updates)
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// PUT /api/inventory/:id/adjust - Quick quantity adjust (+/-)
router.put('/:id/adjust', async (req, res) => {
  try {
    const { delta } = req.body; // positive = add, negative = subtract
    if (typeof delta !== 'number') return res.status(400).json({ error: 'Delta must be a number' });

    // Get current quantity
    const { data: item } = await supabase
      .from('inventory_items')
      .select('quantity, reorder_level, name')
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id)
      .single();

    if (!item) return res.status(404).json({ error: 'Item not found' });

    const newQty = Math.max(0, item.quantity + delta);

    const { data, error } = await supabase
      .from('inventory_items')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id)
      .select()
      .single();

    if (error) throw error;

    // Alert if below threshold
    if (newQty <= item.reorder_level && item.reorder_level > 0) {
      // Send email alert (fire-and-forget)
      const { data: workspace } = await supabase.from('workspaces').select('*').eq('id', req.user.workspace_id).single();
      const updatedItem = { ...item, quantity: newQty };
      sendLowStockAlert(updatedItem, workspace).catch(console.error);
      webhookEvents.inventoryLow(req.user.workspace_id, updatedItem).catch(() => {});

      res.json({ ...data, warning: `${item.name} is below reorder level (${newQty}/${item.reorder_level})` });
    } else {
      res.json(data);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to adjust quantity' });
  }
});

// DELETE /api/inventory/:id - Delete item
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', req.user.workspace_id);

    if (error) throw error;
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = router;
