// Main plugin code
// Handle commands from menu/keyboard shortcuts and relaunch buttons
if (figma.command === 'toggle-guides') {
  // Run toggle guides for all frames without UI
  toggleGuides();
  figma.closePlugin();
} else if (figma.command === 'toggle-guides-context') {
  // Run toggle guides for selected frames only (from relaunch button)
  toggleGuidesForSelection();
  figma.closePlugin();
} else if (figma.command === 'edit-guides') {
  // Open UI with existing settings pre-filled
  openUIWithExistingSettings();
} else {
  // Open UI for main plugin functionality
  figma.showUI(__html__, { width: 355, height: 568 });
}

// Handle messages from UI
figma.ui.onmessage = (msg) => {
  console.log('Received message:', msg); // Debug log
  
  if (msg.type === 'convert-to-strokes') {
    convertLayoutGridsToStrokes(msg.columnColor, msg.rowColor, msg.strokeWidth, msg.opacity);
  } else if (msg.type === 'toggle-guides') {
    toggleGuides();
  } else if (msg.type === 'clear-guides') {
    clearGuides();
  } else if (msg.type === 'ui-loaded') {
    // Send existing settings to UI when it loads and start listening for selection changes
    sendExistingSettingsToUI();
    startSelectionListener();
  } else if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

let selectionChangeHandler = null;

function startSelectionListener() {
  // Set up selection change listener
  selectionChangeHandler = () => {
    sendExistingSettingsToUI();
  };
  
  figma.on('selectionchange', selectionChangeHandler);
  console.log('Started listening for selection changes');
}

function stopSelectionListener() {
  if (selectionChangeHandler) {
    figma.off('selectionchange', selectionChangeHandler);
    selectionChangeHandler = null;
    console.log('Stopped listening for selection changes');
  }
}

// Make sure to clean up listener when plugin closes
figma.on('close', () => {
  stopSelectionListener();
});

function convertLayoutGridsToStrokes(columnColor, rowColor, strokeWidth, opacity) {
  const selection = figma.currentPage.selection;
  let processedCount = 0;

  console.log('Selection:', selection); // Debug log
  console.log('Selection length:', selection.length); // Debug log

  selection.forEach(node => {
    console.log('Checking node:', node.name, node.type); // Debug log
    
    if ('layoutGrids' in node && node.layoutGrids && node.layoutGrids.length > 0) {
      console.log('Found layout grids:', node.layoutGrids); // Debug log
      
      // Clear existing guides first
      clearGuidesFromFrame(node);
      
      processedCount++;
      createStrokeGuides(node, columnColor, rowColor, strokeWidth, opacity);
    } else {
      console.log('No layout grids found on node:', node.name); // Debug log
    }
  });

  if (processedCount === 0) {
    figma.notify('Please select frames with layout grids');
    console.log('No frames with layout grids found'); // Debug log
  } else {
    figma.notify(`Created stroke guides for ${processedCount} frame(s)`);
    console.log(`Processed ${processedCount} frames`); // Debug log
  }
  sendExistingSettingsToUI(); // Update UI status
}

function createStrokeGuides(frame, columnColor, rowColor, strokeWidth, opacity) {
  const layoutGrids = frame.layoutGrids;
  
  // Create main container frame for guides inside the original frame
  const guidesContainer = figma.createFrame();
  guidesContainer.name = 'Guides';
  guidesContainer.x = 0;
  guidesContainer.y = 0;
  guidesContainer.resize(frame.width, frame.height);
  guidesContainer.backgrounds = []; // Transparent background
  
  // Set constraints for the main guides container to fill the parent
  guidesContainer.constraints = {
    horizontal: 'STRETCH',
    vertical: 'STRETCH'
  };
  
  // Create separate containers for rows and columns
  const rowsContainer = figma.createFrame();
  rowsContainer.name = 'Rows';
  rowsContainer.x = 0;
  rowsContainer.y = 0;
  rowsContainer.resize(frame.width, frame.height);
  rowsContainer.backgrounds = []; // Transparent background
  rowsContainer.constraints = {
    horizontal: 'STRETCH',
    vertical: 'STRETCH'
  };
  
  const columnsContainer = figma.createFrame();
  columnsContainer.name = 'Columns';
  columnsContainer.x = 0;
  columnsContainer.y = 0;
  columnsContainer.resize(frame.width, frame.height);
  columnsContainer.backgrounds = []; // Transparent background
  columnsContainer.constraints = {
    horizontal: 'STRETCH',
    vertical: 'STRETCH'
  };
  
  // Add containers to guides container
  guidesContainer.appendChild(rowsContainer);
  guidesContainer.appendChild(columnsContainer);
  
  // Process each layout grid
  layoutGrids.forEach((grid, index) => {
    if (grid.pattern === 'COLUMNS') {
      createColumnStrokes(columnsContainer, grid, frame, columnColor, strokeWidth, opacity);
    } else if (grid.pattern === 'ROWS') {
      createRowStrokes(rowsContainer, grid, frame, rowColor, strokeWidth, opacity);
    }
  });

  // Add the guides container inside the original frame
  frame.appendChild(guidesContainer);
  
  // Store the settings used to create these guides
  storeGuideSettings(frame, columnColor, rowColor, strokeWidth, opacity);
  
  // Set up relaunch buttons
  setupRelaunchButtons(frame);
  
  // Organize the layers panel
  organizeLayersPanel(guidesContainer, rowsContainer, columnsContainer);
}

function createColumnStrokes(container, grid, originalFrame, columnColor, strokeWidth, opacity) {
  const frameWidth = originalFrame.width;
  const frameHeight = originalFrame.height;
  const columnCount = grid.count || 1;
  const gutterSize = grid.gutterSize || 0;
  const margin = grid.offset || 0;
  
  console.log('Creating column strokes:', { frameWidth, frameHeight, columnCount, gutterSize, margin });
  
  // Calculate column positions
  const availableWidth = frameWidth - (2 * margin);
  const totalGutterWidth = gutterSize * (columnCount - 1);
  const columnWidth = (availableWidth - totalGutterWidth) / columnCount;
  
  // Create vertical lines for each column (left and right edges)
  for (let i = 0; i < columnCount; i++) {
    // Left edge of column
    const leftX = margin + (i * columnWidth) + (i * gutterSize);
    
    // Right edge of column  
    const rightX = leftX + columnWidth;
    
    console.log(`Creating column ${i} guides at x: ${leftX} and ${rightX}`);
    
    // Create left edge line
    const leftLine = figma.createVector();
    leftLine.vectorPaths = [{
      windingRule: "NONZERO",
      data: `M ${leftX} 0 L ${leftX} ${frameHeight}`
    }];
    leftLine.strokes = [{
      type: 'SOLID',
      color: hexToRgb(columnColor)
    }];
    leftLine.strokeWeight = strokeWidth;
    leftLine.opacity = opacity;
    leftLine.name = `Column ${i} Left`;
    
    // Set constraints for columns: scale horizontally, pin to top/bottom
    leftLine.constraints = {
      horizontal: 'SCALE',
      vertical: 'STRETCH'
    };
    
    container.appendChild(leftLine);
    
    // Create right edge line
    const rightLine = figma.createVector();
    rightLine.vectorPaths = [{
      windingRule: "NONZERO", 
      data: `M ${rightX} 0 L ${rightX} ${frameHeight}`
    }];
    rightLine.strokes = [{
      type: 'SOLID',
      color: hexToRgb(columnColor)
    }];
    rightLine.strokeWeight = strokeWidth;
    rightLine.opacity = opacity;
    rightLine.name = `Column ${i} Right`;
    
    // Set constraints for columns: scale horizontally, pin to top/bottom
    rightLine.constraints = {
      horizontal: 'SCALE',
      vertical: 'STRETCH'
    };
    
    container.appendChild(rightLine);
  }
}

function createRowStrokes(container, grid, originalFrame, rowColor, strokeWidth, opacity) {
  const frameWidth = originalFrame.width;
  const frameHeight = originalFrame.height;
  const rowCount = grid.count || 1;
  const gutterSize = grid.gutterSize || 0;
  const margin = grid.offset || 0;
  
  console.log('Creating row strokes:', { frameWidth, frameHeight, rowCount, gutterSize, margin });
  
  // Calculate row positions
  const availableHeight = frameHeight - (2 * margin);
  const totalGutterHeight = gutterSize * (rowCount - 1);
  const rowHeight = (availableHeight - totalGutterHeight) / rowCount;
  
  // Create horizontal lines for each row (top and bottom edges)
  for (let i = 0; i < rowCount; i++) {
    // Top edge of row
    const topY = margin + (i * rowHeight) + (i * gutterSize);
    
    // Bottom edge of row
    const bottomY = topY + rowHeight;
    
    console.log(`Creating row ${i} guides at y: ${topY} and ${bottomY}`);
    
    // Create top edge line
    const topLine = figma.createVector();
    topLine.vectorPaths = [{
      windingRule: "NONZERO",
      data: `M 0 ${topY} L ${frameWidth} ${topY}`
    }];
    topLine.strokes = [{
      type: 'SOLID',
      color: hexToRgb(rowColor)
    }];
    topLine.strokeWeight = strokeWidth;
    topLine.opacity = opacity;
    topLine.name = `Row ${i} Top`;
    
    // Set constraints for rows: pin to left/right, scale vertically
    topLine.constraints = {
      horizontal: 'STRETCH',
      vertical: 'SCALE'
    };
    
    container.appendChild(topLine);
    
    // Create bottom edge line
    const bottomLine = figma.createVector();
    bottomLine.vectorPaths = [{
      windingRule: "NONZERO",
      data: `M 0 ${bottomY} L ${frameWidth} ${bottomY}`
    }];
    bottomLine.strokes = [{
      type: 'SOLID',
      color: hexToRgb(rowColor)
    }];
    bottomLine.strokeWeight = strokeWidth;
    bottomLine.opacity = opacity;
    bottomLine.name = `Row ${i} Bottom`;
    
    // Set constraints for rows: pin to left/right, scale vertically
    bottomLine.constraints = {
      horizontal: 'STRETCH',
      vertical: 'SCALE'
    };
    
    container.appendChild(bottomLine);
  }
}

function organizeLayersPanel(guidesContainer, rowsContainer, columnsContainer) {
  // Collapse the container frames in the layers panel
  guidesContainer.expanded = false;
  rowsContainer.expanded = false;
  columnsContainer.expanded = false;
  
  // Lock the guides frame to prevent accidental editing
  guidesContainer.locked = true;
  
  console.log('Organized layers panel: collapsed containers and locked guides frame');
}

function findGuidesContainer(frame) {
  // Look for existing guides container in the frame
  return frame.children.find(child => child.name === 'Guides' && child.type === 'FRAME');
}

function clearGuidesFromFrame(frame) {
  const guidesContainer = findGuidesContainer(frame);
  if (guidesContainer) {
    guidesContainer.remove();
    // Clear relaunch buttons when guides are removed
    frame.setRelaunchData({});
    console.log('Removed existing guides from frame:', frame.name);
  }
}

function storeGuideSettings(frame, columnColor, rowColor, strokeWidth, opacity) {
  // Store the settings as plugin data so we can retrieve them later
  frame.setPluginData('columnColor', columnColor);
  frame.setPluginData('rowColor', rowColor);
  frame.setPluginData('strokeWidth', strokeWidth.toString());
  frame.setPluginData('opacity', opacity.toString());
  console.log('Stored guide settings for frame:', frame.name);
}

function getStoredGuideSettings(frame) {
  // Retrieve stored settings, with defaults if not found
  const columnColor = frame.getPluginData('columnColor') || '#ff6b6b';
  const rowColor = frame.getPluginData('rowColor') || '#4ecdc4';
  const strokeWidth = parseFloat(frame.getPluginData('strokeWidth')) || 1;
  const opacity = parseFloat(frame.getPluginData('opacity')) || 0.8;
  
  return { columnColor, rowColor, strokeWidth, opacity };
}

function setupRelaunchButtons(frame) {
  const guidesContainer = findGuidesContainer(frame);
  const isVisible = guidesContainer ? guidesContainer.visible : false;
  
  // Set context-aware relaunch buttons
  const toggleButtonName = isVisible ? 'Hide Guides' : 'Show Guides';
  
  frame.setRelaunchData({
    'toggle-guides-context': toggleButtonName,
    'edit-guides': 'Edit Guides'
  });
  
  console.log('Set relaunch buttons for frame:', frame.name, 'toggle button:', toggleButtonName);
}

function updateRelaunchButtons(frame) {
  // Update the toggle button label based on current visibility
  const guidesContainer = findGuidesContainer(frame);
  if (guidesContainer) {
    setupRelaunchButtons(frame);
  }
}

function toggleGuidesForSelection() {
  const selection = figma.currentPage.selection;
  let toggledCount = 0;

  selection.forEach(node => {
    if (node.type === 'FRAME') {
      const guidesContainer = findGuidesContainer(node);
      if (guidesContainer) {
        guidesContainer.visible = !guidesContainer.visible;
        updateRelaunchButtons(node);
        toggledCount++;
        console.log('Toggled guides visibility for frame:', node.name, 'visible:', guidesContainer.visible);
      }
    }
  });

  if (toggledCount === 0) {
    figma.notify('No guides found in selected frames');
  } else {
    figma.notify(`Toggled guides visibility for ${toggledCount} frame(s)`);
  }
}

function openUIWithExistingSettings() {
  figma.showUI(__html__, { width: 300, height: 420 });
}

function sendExistingSettingsToUI() {
  const selection = figma.currentPage.selection;
  let frameName = null;
  let hasGuides = false;
  let hasLayoutGrids = false;
  let settingsToSend = {
    columnColor: '#ff6b6b',
    rowColor: '#4ecdc4',
    strokeWidth: 1,
    opacity: 0.8
  };

  if (selection.length === 1 && selection[0].type === 'FRAME') {
    const node = selection[0];
    frameName = node.name;
    const guidesContainer = findGuidesContainer(node);
    hasGuides = !!guidesContainer;
    hasLayoutGrids = Array.isArray(node.layoutGrids) && node.layoutGrids.length > 0;

    if (hasGuides) {
      settingsToSend = getStoredGuideSettings(node);
    }
  }

  figma.ui.postMessage({
    type: 'load-existing-settings',
    settings: settingsToSend,
    frameName,
    hasGuides,
    hasLayoutGrids
  });
  console.log('Sent frame status to UI:', { frameName, hasGuides, hasLayoutGrids, settingsToSend });
}

function clearGuides() {
  const selection = figma.currentPage.selection;
  let clearedCount = 0;

  selection.forEach(node => {
    if (node.type === 'FRAME') {
      const guidesContainer = findGuidesContainer(node);
      if (guidesContainer) {
        guidesContainer.remove();
        clearedCount++;
        console.log('Cleared guides from frame:', node.name);
      }
    }
  });

  if (clearedCount === 0) {
    figma.notify('No guides found in selected frames');
  } else {
    figma.notify(`Cleared guides from ${clearedCount} frame(s)`);
  }
  sendExistingSettingsToUI(); // Update UI status
}

function toggleGuides() {
  // Find all frames with guides on the current page
  const allFramesWithGuides = [];
  
  function findFramesWithGuidesRecursive(node) {
    if (node.type === 'FRAME') {
      const guidesContainer = findGuidesContainer(node);
      if (guidesContainer) {
        allFramesWithGuides.push({ frame: node, guides: guidesContainer });
      }
    }
    
    // Recursively check children
    if ('children' in node) {
      for (const child of node.children) {
        findFramesWithGuidesRecursive(child);
      }
    }
  }
  
  // Search the entire current page
  findFramesWithGuidesRecursive(figma.currentPage);
  
  if (allFramesWithGuides.length === 0) {
    figma.notify('No stroke guides found on this page');
    return;
  }
  
  // Determine the new visibility state based on the first frame
  // If any guides are visible, hide all; if all are hidden, show all
  const anyVisible = allFramesWithGuides.some(item => item.guides.visible);
  const newVisibility = !anyVisible;
  
  // Apply the new visibility to all guides
  allFramesWithGuides.forEach(item => {
    item.guides.visible = newVisibility;
  });
  
  const action = newVisibility ? 'Shown' : 'Hidden';
  figma.notify(`${action} stroke guides for ${allFramesWithGuides.length} frame(s)`);
  console.log(`${action} guides for ${allFramesWithGuides.length} frames on page:`, figma.currentPage.name);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : {r: 1, g: 0, b: 0}; // Default to red if parsing fails
}