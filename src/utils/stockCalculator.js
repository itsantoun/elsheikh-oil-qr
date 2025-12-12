// utils/stockCalculator.js
import { ref, get, set, push, update } from 'firebase/database';

export const calculateProductStock = async (barcode, database) => {
  try {
    const db = database;
    
    // Get all relevant data in parallel
    const [productSnap, transactionsSnap, soldItemsSnap] = await Promise.all([
      get(ref(db, `products/${barcode}`)),
      get(ref(db, 'transactions')),
      get(ref(db, 'SoldItems'))
    ]);
    
    // Get initial quantity from product
    let initialQuantity = 0;
    let productName = '';
    
    if (productSnap.exists()) {
      const productData = productSnap.val();
      initialQuantity = parseFloat(productData.quantity) || 0;
      productName = productData.name || '';
    }
    
    let totalSold = 0;
    let transactionsCount = 0;
    let soldItemsCount = 0;
    
    // Sum from transactions (CONFIRMED status)
    if (transactionsSnap.exists()) {
      const transactions = transactionsSnap.val();
      Object.values(transactions).forEach(transaction => {
        const transBarcode = transaction.barcode || transaction.productId;
        const transName = transaction.name || transaction.productName;
        
        // Match by barcode OR name
        const matchesProduct = 
          transBarcode === barcode ||
          (productName && transName && 
           transName.toLowerCase() === productName.toLowerCase());
        
        if (matchesProduct && transaction.paymentStatus === 'Confirmed') {
          const quantity = parseFloat(transaction.quantity) || 0;
          totalSold += quantity;
          transactionsCount += quantity;
        }
      });
    }
    
    // Sum from SoldItems (PAID status)
    if (soldItemsSnap.exists()) {
      const soldItems = soldItemsSnap.val();
      Object.values(soldItems).forEach(item => {
        const itemBarcode = item.barcode || '';
        const itemName = item.name || '';
        
        // Match by barcode OR name
        const matchesProduct = 
          itemBarcode === barcode ||
          (productName && itemName && 
           itemName.toLowerCase() === productName.toLowerCase());
        
        if (matchesProduct && item.paymentStatus === 'Paid') {
          const quantity = parseFloat(item.quantity) || 0;
          totalSold += quantity;
          soldItemsCount += quantity;
        }
      });
    }
    
    const calculatedRemaining = initialQuantity - totalSold;
    
    return {
      barcode,
      productName,
      initialQuantity,
      totalSold,
      calculatedRemaining,
      breakdown: {
        fromTransactions: transactionsCount,
        fromSoldItems: soldItemsCount
      },
      lastCalculated: new Date().toISOString(),
      isValid: calculatedRemaining >= 0
    };
    
  } catch (error) {
    console.error('Error in calculateProductStock:', error);
    throw error;
  }
};

export const validateStockQuantity = (currentQuantity, newQuantity, varianceThreshold = 0.1) => {
  const current = parseFloat(currentQuantity) || 0;
  const newQty = parseFloat(newQuantity) || 0;
  
  if (newQty < 0) {
    return {
      valid: false,
      message: 'Quantity cannot be negative',
      discrepancy: 0
    };
  }
  
  const discrepancy = Math.abs(current - newQty);
  const percentageDiff = current > 0 ? (discrepancy / current) * 100 : 100;
  
  if (percentageDiff > varianceThreshold * 100) {
    return {
      valid: false,
      message: `Large variance detected: ${percentageDiff.toFixed(1)}%`,
      discrepancy,
      percentageDiff
    };
  }
  
  return {
    valid: true,
    message: 'Quantity validated',
    discrepancy,
    percentageDiff
  };
};

export const logStockChange = async (database, changeData) => {
  try {
    const logRef = ref(database, 'stockAuditLogs');
    await set(push(logRef), {
      ...changeData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log stock change:', error);
  }
};