const ExcelJS = require('exceljs');
const Asset = require('../models/Asset');
const Log = require('../models/Log');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Helper to map Excel columns to asset fields
const assetColumnMap = {
  'asset code': 'assetId',
  'asset id': 'assetId',
  'id': 'assetId',
  'asset name': 'name',
  'name': 'name',
  'serial no.': 'serialNumber',
  'serial number': 'serialNumber',
  'serial no': 'serialNumber',
  'asset type': 'type',
  'type': 'type',
  'brand': 'brand',
  'make': 'brand',
  'model': 'model',
  'model no.': 'model',
  'purchase date': 'purchaseDate',
  'date of purchase': 'purchaseDate',
  'location code': 'location',
  'location': 'location',
  'asset status': 'status',
  'status': 'status',
  'assigned to (name)': 'assignedTo',
  'assigned to': 'assignedTo',
  'current user email id': 'userEmail',
  'user email': 'userEmail'
};

const logColumnMap = {
  'assigned on': 'date',
  'service status': 'action',
  'remarks/note (if any)': 'remarks'
};

// Generate a clean Excel template
const downloadTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Asset Template');
    const headers = [
      'Asset code',
      'Asset name',
      'Serial no.',
      'Asset type',
      'Brand',
      'Model',
      'Purchase Date',
      'Location Code',
      'Asset status',
      'Assigned to (Name)',
      'Current User Email ID'
    ];
    worksheet.addRow(headers);
    // Set some styling (optional)
    worksheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true };
    });
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="asset_template.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Template generation error:', err);
    res.status(500).json({ message: 'Failed to generate template' });
  }
};

/**
 * Robust Date Parser
 * Handles: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, and Excel Date Objects
 */
const parseDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  
  const dateStr = String(val).trim();
  if (!dateStr) return null;

  // Try standard ISO parsing first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) return isoDate;

  // Handle common formats manually: DD/MM/YYYY or MM/DD/YYYY
  const parts = dateStr.split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    // Assume YYYY at p0 or p2
    if (p0 > 1900) return new Date(p0, p1 - 1, p2); // YYYY-MM-DD
    if (p2 > 1900) {
      // Ambiguity between DD/MM and MM/DD. 
      // Default to DD/MM/YYYY but check if p1 > 12
      if (p1 > 12) return new Date(p2, p0 - 1, p1); // MM/DD/YYYY
      return new Date(p2, p1 - 1, p0); // DD/MM/YYYY
    }
  }
  
  return null;
};

/**
 * Smart Brand Inference Utility
 * Detects brand from model string using keyword matching
 */
const inferBrand = (model) => {
  if (!model) return "Unknown";
  const m = String(model).toLowerCase();
  
  const brandKeywords = {
    'Dell': ['dell', 'latitude', 'optiplex', 'vostro', 'xps', 'precision', 'alienware'],
    'HP': ['hp', 'pavilion', 'probook', 'elitebook', 'zbook', 'spectre', 'envy', 'laserjet', 'prodesk', 'elitedesk'],
    'Lenovo': ['lenovo', 'thinkpad', 'thinkcentre', 'ideapad', 'yoga', 'legion', 'thinkstation'],
    'Apple': ['apple', 'macbook', 'imac', 'ipad', 'iphone', 'mac mini', 'airpods', 'mac pro'],
    'Samsung': ['samsung', 'galaxy', 'tab', 'monitor', 'syncmaster'],
    'Acer': ['acer', 'aspire', 'swift', 'nitro', 'predator', 'travelmate'],
    'Asus': ['asus', 'vivobook', 'zenbook', 'rog', 'tuf', 'expertbook'],
    'Logitech': ['logitech', 'logi'],
    'Cisco': ['cisco', 'catalyst', 'nexus', 'meraki'],
    'TP-Link': ['tp-link', 'tplink', 'archer', 'deco'],
    'D-Link': ['d-link', 'dlink'],
    'Epson': ['epson', 'ecotank'],
    'Canon': ['canon', 'pixma', 'imageclass'],
    'Brother': ['brother', 'hl-'],
    'Ubiquiti': ['ubiquiti', 'unifi', 'edgerouter'],
    'Mikrotik': ['mikrotik', 'routerboard'],
    'Netgear': ['netgear', 'nighthawk'],
    'Sony': ['sony', 'vaio', 'playstation'],
    'Microsoft': ['microsoft', 'surface'],
    'Toshiba': ['toshiba', 'dynabook'],
    'Panasonic': ['panasonic', 'toughbook'],
    'ViewSonic': ['viewsonic'],
    'BenQ': ['benq'],
    'LG': ['lg', 'gram', 'ultrafine']
  };

  for (const [brand, keywords] of Object.entries(brandKeywords)) {
    if (keywords.some(kw => m.includes(kw))) {
      return brand;
    }
  }

  return "Unknown";
};

/**
 * Data Transformation & Sanitization Layer
 */
const transformRow = (row, headers) => {
  const data = {};
  const normalizedRow = {};

  // 1. Normalize row to lowercase keys
  Object.keys(row).forEach(key => {
    normalizedRow[key.trim().toLowerCase()] = row[key];
  });

  // 2. Map using fuzzy aliases
  Object.entries(assetColumnMap).forEach(([alias, field]) => {
    if (normalizedRow[alias] !== undefined && normalizedRow[alias] !== null && normalizedRow[alias] !== '') {
      data[field] = normalizedRow[alias];
    }
  });

  // 3. Clean and Validate specific types
  if (data.assetId) data.assetId = String(data.assetId).trim();
  if (data.serialNumber) data.serialNumber = String(data.serialNumber).trim();
  if (data.brand) data.brand = String(data.brand).trim();
  if (data.model) data.model = String(data.model).trim();
  if (data.type) data.type = String(data.type).trim();
  if (data.location) data.location = String(data.location).trim();
  if (data.assignedTo) data.assignedTo = String(data.assignedTo).trim();
  if (data.userEmail) data.userEmail = String(data.userEmail).trim();

  // 4. Robust Date Parsing
  data.purchaseDate = parseDate(data.purchaseDate) || new Date();

  // 5. Status Mapping (Normalize to Allowed Enum)
  if (data.status) {
    const statusMap = {
      'active': 'Active',
      'in use': 'In Use',
      'in stock': 'In Stock',
      'reserved': 'Reserved',
      'repair': 'Repair',
      'scrap': 'Scrap'
    };
    data.status = statusMap[String(data.status).toLowerCase().trim()] || 'Active';
  } else {
    data.status = data.assignedTo ? 'In Use' : 'In Stock';
  }

  // 6. Smart Inference & Fallbacks
  // If name is missing but brand/model exist
  if (!data.name) {
    if (data.brand && data.model) {
      data.name = `${data.brand} ${data.model}`;
    } else {
      data.name = data.model || data.brand || "Unknown Asset";
    }
  }
  
  // If name exists, try to extract brand/model if they are missing
  const nameStr = String(data.name || '').trim();
  
  if (!data.brand || data.brand === "Unknown" || data.brand === "Unknown Brand") {
    const inferredBrand = inferBrand(nameStr);
    if (inferredBrand !== "Unknown") {
      data.brand = inferredBrand;
    } else if (data.model) {
      data.brand = inferBrand(data.model);
    }
  }

  if (!data.model || data.model === "Unknown Model") {
    let potentialModel = nameStr;
    if (data.brand && data.brand !== "Unknown") {
      // Remove brand from name to get model
      const brandRegex = new RegExp(`\\b${data.brand}\\b`, 'gi');
      potentialModel = potentialModel.replace(brandRegex, '').trim();
    }
    data.model = potentialModel || "Unknown Model";
  }

  // Ensure "Unknown" fallback if still empty
  if (!data.brand) data.brand = "Unknown Brand";
  if (!data.model) data.model = "Unknown Model";
  if (!data.type) data.type = "Other";
  if (!data.location) data.location = "Main Store";

  return data;
};

// Import assets from uploaded Excel file
const importExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];
    
    const headerRow = worksheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell) => {
      headers.push(String(cell.value).trim().toLowerCase());
    });

    const rowsToProcess = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      
      const rawRow = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) rawRow[header] = cell.value;
      });

      const transformed = transformRow(rawRow, headers);
      rowsToProcess.push({ rowNumber, data: transformed });
    });

    const successCount = [];
    const errors = [];

    // Process each row sequentially for detailed error reporting
    for (const item of rowsToProcess) {
      try {
        const { rowNumber, data } = item;

        // Manual validation before save
        if (!data.assetId || !data.serialNumber) {
          errors.push({ row: rowNumber, error: "Missing mandatory Asset ID or Serial Number" });
          continue;
        }

        // Check for duplicates
        const existing = await Asset.findOne({ 
          $or: [{ assetId: data.assetId }, { serialNumber: data.serialNumber }] 
        });

        if (existing) {
          errors.push({ row: rowNumber, error: `Duplicate detected (${existing.assetId === data.assetId ? 'Asset ID' : 'Serial No'})` });
          continue;
        }

        const asset = new Asset(data);
        await asset.save();
        successCount.push(asset);
      } catch (err) {
        errors.push({ row: item.rowNumber, error: err.message });
      }
    }

    res.status(200).json({
      totalRows: rowsToProcess.length,
      successCount: successCount.length,
      failureCount: errors.length,
      errors: errors.map(e => `Row ${e.row}: ${e.error}`)
    });

  } catch (error) {
    console.error('Import process failed:', error);
    res.status(500).json({ message: 'Critical import failure', error: error.message });
  }
};



// @desc    Get all assets
// @route   GET /api/assets
// @access  Private
const getAssets = async (req, res) => {
    try {
        const assets = await Asset.find({});
        res.json(assets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single asset by ID
// @route   GET /api/assets/:id
// @access  Private
const getAssetById = async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id);
        if (asset) {
            res.json(asset);
        } else {
            res.status(404).json({ message: 'Asset not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new asset
// @route   POST /api/assets
// @access  Private (Admin only)
const createAsset = async (req, res) => {
    try {
        let { assetId, type, name, brand, model, serialNumber, purchaseDate, location, status, assignedTo, userEmail } = req.body;

        // Auto-generate Asset ID if not provided
        if (!assetId) {
            const count = await Asset.countDocuments();
            assetId = `AST-${Date.now().toString().slice(-6)}${count + 1}`;
        }

        const assetExists = await Asset.findOne({ assetId });
        if (assetExists) {
            res.status(400).json({ message: 'Asset ID already exists' });
            return;
        }

        const asset = new Asset({
            assetId,
            type,
            name,
            brand,
            model,
            serialNumber,
            purchaseDate,
            location,
            status: status || 'Active',
            assignedTo,
            userEmail
        });

        const createdAsset = await asset.save();

        // Create initial log
        const log = new Log({
            assetId: createdAsset._id,
            action: 'Maintenance',
            user: req.user.name,
            remarks: 'Initial asset registration'
        });
        await log.save();

        res.status(201).json(createdAsset);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update asset
// @route   PUT /api/assets/:id
// @access  Private (Admin only)
const updateAsset = async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id);

        if (asset) {
            asset.type = req.body.type || asset.type;
            asset.name = req.body.name || asset.name;
            asset.brand = req.body.brand || asset.brand;
            asset.model = req.body.model || asset.model;
            asset.location = req.body.location || asset.location;
            asset.status = req.body.status || asset.status;
            asset.assignedTo = req.body.assignedTo || asset.assignedTo;
            asset.userEmail = req.body.userEmail || asset.userEmail;

            const updatedAsset = await asset.save();
            res.json(updatedAsset);
        } else {
            res.status(404).json({ message: 'Asset not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete asset
// @route   DELETE /api/assets/:id
// @access  Private (Admin only)
const deleteAsset = async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id);

        if (asset) {
            await Asset.deleteOne({ _id: asset._id });
            // Optionally delete associated logs
            await Log.deleteMany({ assetId: asset._id });
            res.json({ message: 'Asset removed' });
        } else {
            res.status(404).json({ message: 'Asset not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk import assets
// @route   POST /api/assets/import
// @access  Private (Admin only)
const importAssets = async (req, res) => {
    try {
        const assets = req.body; // Array of asset objects
        
        // Simple validation and insertion
        // In production, you'd want more robust validation and error reporting
        const result = await Asset.insertMany(assets, { ordered: false });
        
        res.status(201).json({ 
            message: `Successfully imported ${result.length} assets`,
            count: result.length 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Image Upload Configuration
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const uploadImage = multer({
    storage: imageStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'), false);
        }
    }
});

// @desc    Upload asset image
// @route   POST /api/assets/:id/image
// @access  Private (Admin only)
const uploadAssetImage = async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id);
        if (!asset) {
            return res.status(404).json({ message: 'Asset not found' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No image file uploaded' });
        }

        asset.imageUrl = `/uploads/${req.file.filename}`;
        await asset.save();

        res.json({ 
            message: 'Image uploaded successfully', 
            imageUrl: asset.imageUrl 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPublicAsset = async (req, res) => {
    try {
        const asset = await Asset.findOne({ assetId: req.params.assetCode });
        if (!asset) {
            return res.status(404).json({ message: 'Asset not found' });
        }
        
        // Return only public fields
        const publicAsset = {
            name: asset.name,
            serialNumber: asset.serialNumber,
            type: asset.type,
            brand: asset.brand,
            model: asset.model,
            purchaseDate: asset.purchaseDate,
            location: asset.location,
            status: asset.status,
            assignedTo: asset.assignedTo,
            userEmail: asset.userEmail,
            imageUrl: asset.imageUrl,
            assetId: asset.assetId,
            _id: asset._id
        };

        res.json(publicAsset);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getNetworkInfo = (req, res) => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIp = 'localhost';
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
                break;
            }
        }
        if (localIp !== 'localhost') break;
    }
    
    res.json({ localIp, port: process.env.PORT || 5000 });
};

module.exports = {
    getAssets,
    getAssetById,
    getPublicAsset,
    getNetworkInfo,
    createAsset,
    updateAsset,
    deleteAsset,
    deleteAllAssets,
    importAssets,
    importExcel,
    downloadTemplate,
    upload,
    uploadImage,
    uploadAssetImage
};
