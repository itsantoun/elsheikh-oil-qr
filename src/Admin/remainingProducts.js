import React, { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../Auth/firebase'; // Adjust the path as necessary
import '../CSS/remainingProducts.css'; // Import the CSS file

function RemainingProducts() {
  const [products, setProducts] = useState([]);
  const [soldItems, setSoldItems] = useState([]);

  // Fetch products from 'products' database
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsRef = ref(database, 'products');
        const snapshot = await get(productsRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const productList = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          setProducts(productList);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchProducts();
  }, []);

  // Fetch sold items from 'SoldItems' database
  useEffect(() => {
    const fetchSoldItems = async () => {
      try {
        const soldItemsRef = ref(database, 'SoldItems');
        const snapshot = await get(soldItemsRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const soldItemList = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          setSoldItems(soldItemList);
        }
      } catch (error) {
        console.error('Error fetching sold items:', error);
      }
    };

    fetchSoldItems();
  }, []);

  // Calculate the total quantity sold per product by product name
  const calculateQuantitySold = (productName) => {
    return soldItems.reduce((total, item) => {
      // Ensure each item has a 'productName' and 'quantity' field
      if (item.productName === productName) { // Match by productName
        return total + (item.quantity || 0); // Sum quantities sold for matching product name
      }
      return total;
    }, 0);
  };

  return (
    <div className="remaining-products-container">
      <h2 className="remaining-products-heading">Remaining Products</h2>
      <ul className="remaining-products-list">
        {products.map((product) => {
          const quantitySold = calculateQuantitySold(product.name); // Calculate total quantity sold based on product name
          const remainingQuantity = product.quantity - quantitySold; // Remaining quantity

          return (
            <li key={product.id} className="remaining-products-list-item">
              <span className="remaining-products-item-name">{product.name}</span>
              <span className="remaining-products-quantity-sold">
                Quantity Sold: {quantitySold}
              </span>
              <span className="remaining-products-remaining-quantity">
                Remaining Quantity: {remainingQuantity}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default RemainingProducts;