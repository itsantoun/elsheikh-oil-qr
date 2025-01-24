import React, { useState, useEffect } from 'react';

function RemainingProducts({ soldItems, totalQuantities }) {
  const [remainingQuantities, setRemainingQuantities] = useState({});
  const [loading, setLoading] = useState(true); // Add loading state

  useEffect(() => {
    console.log('useEffect triggered');
    console.log('soldItems:', soldItems);
    console.log('totalQuantities:', totalQuantities);

    // Only calculate remaining quantities if soldItems and totalQuantities are available
    if (Array.isArray(soldItems) && totalQuantities) {
      if (soldItems.length === 0) {
        setRemainingQuantities({}); // Handle empty array case
        setLoading(false); // Finished loading
        console.log('No sold items, remaining quantities:', remainingQuantities);
        return;
      }

      const calculateRemainingQuantities = () => {
        const remaining = { ...totalQuantities }; // Start with total quantities
        console.log('Starting remaining quantities:', remaining);

        soldItems.forEach((item) => {
          const { category, quantity } = item;

          console.log('Processing item:', item);

          // Skip if there's no category or quantity
          if (!category || quantity === undefined || quantity === null) {
            console.log('Skipping invalid item:', item);
            return;
          }

          // Check if the category exists in totalQuantities
          if (remaining[category] !== undefined) {
            // Subtract the sold quantity from the remaining quantity
            const newQuantity = Math.max(remaining[category] - quantity, 0); // Ensure no negative quantity
            console.log(`Subtracting ${quantity} from ${remaining[category]} for category ${category}, new quantity: ${newQuantity}`);
            remaining[category] = newQuantity;
          } else {
            console.log(`Category ${category} not found in totalQuantities`);
          }
        });

        console.log('Final remaining quantities:', remaining);
        setRemainingQuantities(remaining);
        setLoading(false); // Finished loading after calculation
      };

      calculateRemainingQuantities();
    } else {
      setLoading(false); // Finished loading if soldItems or totalQuantities are not available
      console.log('Invalid data: soldItems or totalQuantities are missing');
    }
  }, [soldItems, totalQuantities]); // Recalculate when soldItems or totalQuantities change

  // Show loading state if still loading
  if (loading) {
    console.log('Loading...');
    return <div>Loading products...</div>;
  }

  console.log('Rendering remaining quantities:', remainingQuantities);

  return (
    <div>
      <h2>Remaining Product Quantities</h2>
      {Object.keys(remainingQuantities).length > 0 ? (
        <ul>
          {Object.entries(remainingQuantities).map(([category, quantity]) => (
            <li key={category}>
              {category}: {quantity} remaining
            </li>
          ))}
        </ul>
      ) : (
        <p>No data available for sold products.</p>
      )}
    </div>
  );
}

export default RemainingProducts;