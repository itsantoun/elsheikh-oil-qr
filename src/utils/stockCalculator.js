// utils/stockCalculator.js
import { ref, get, query, orderByChild, startAt, endAt } from 'firebase/database';

export const calculateStockForDateRange = async (barcode, database, fromDate = null, toDate = null) => {
  try {
    // 1. Get product quantity from Products collection
    const productRef = ref(database, `products/${barcode}`);
    const productSnap = await get(productRef);
    
    if (!productSnap.exists()) {
      throw new Error('Product not found');
    }
    
    const productData = productSnap.val();
    const initialQuantity = parseFloat(productData.quantity) || 0;
    const productName = productData.name || '';
    
    // 2. Get SoldItems for this product in date range
    const soldItemsRef = ref(database, 'SoldItems');
    let soldItemsQuery = soldItemsRef;
    
    // Filter by date if provided
    if (fromDate || toDate) {
      const startDate = fromDate ? new Date(fromDate).getTime() : 0;
      const endDate = toDate ? new Date(toDate).getTime() : Date.now() + 86400000; // Add 1 day
      
      soldItemsQuery = query(
        soldItemsRef,
        orderByChild('dateScanned'),
        startAt(startDate),
        endAt(endDate)
      );
    }
    
    const soldItemsSnap = await get(soldItemsQuery);
    
    // 3. Calculate total sold for this specific product
    let totalSold = 0;
    
    if (soldItemsSnap.exists()) {
      const soldItems = soldItemsSnap.val();
      
      Object.values(soldItems).forEach(item => {
        // Match by barcode OR product name
        const matchesProduct = 
          (item.barcode && item.barcode === barcode) ||
          (item.name && productName && 
           item.name.toLowerCase() === productName.toLowerCase());
        
        // Only count PAID items (not unpaid or stock)
        if (matchesProduct && item.paymentStatus === 'Paid') {
          totalSold += parseFloat(item.quantity) || 0;
        }
      });
    }
    
    // 4. Calculate remaining stock
    const calculatedRemaining = initialQuantity - totalSold;
    
    return {
      success: true,
      product: {
        barcode,
        name: productName,
        initialQuantity
      },
      sold: {
        totalSold,
        dateRange: {
          from: fromDate,
          to: toDate
        }
      },
      calculation: {
        remaining: calculatedRemaining,
        formula: `${initialQuantity} - ${totalSold} = ${calculatedRemaining}`
      }
    };
    
  } catch (error) {
    console.error('Error calculating stock:', error);
    return {
      success: false,
      error: error.message
    };
  }
};