import React, { useState, useEffect } from 'react';
import { ref, get, set, remove } from "firebase/database";
import { database } from '../Auth/firebase';
import '../CSS/admin.css';

const FetchProducts = () => {
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({
    id: '', // Barcode Number
    name: '',
    productType: '', // Product Type (oil or filters)
    totalCost: '', // Total Cost per Product
    itemCost: '', // Item Cost
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch Products
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
        console.error("Error fetching products:", error);
      }
    };

    fetchProducts();
  }, []);

  const sanitizeId = (id) => {
    return id.replace(/[.#$/[\]]/g, '_');
  };

  // Add Product
  const handleAddProduct = async () => {
    if (!newProduct.id) {
      setSuccessMessage("Barcode Number is required!");
      setTimeout(() => setSuccessMessage(null), 3000);
      return;
    }
  
    const sanitizedId = sanitizeId(newProduct.id);
    const productRef = ref(database, `products/${sanitizedId}`);
  
    try {
      const snapshot = await get(productRef);
      if (snapshot.exists()) {
        setSuccessMessage("Barcode Number already exists. Please use a unique ID.");
        setTimeout(() => setSuccessMessage(null), 3000);
        return;
      }
  
      const parsedTotalCost = parseFloat(newProduct.totalCost);
      const parsedItemCost = parseFloat(newProduct.itemCost);
  
      await set(productRef, {
        name: newProduct.name.trim() || 'Unnamed Product',
        productType: newProduct.productType.trim() || 'Unknown Type',
        totalCost: !isNaN(parsedTotalCost) ? parsedTotalCost : null,
        itemCost: !isNaN(parsedItemCost) ? parsedItemCost : null,
      });
  
      setSuccessMessage('Product added successfully!');
      setProducts([
        ...products,
        {
          id: sanitizedId,
          ...newProduct,
          totalCost: !isNaN(parsedTotalCost) ? parsedTotalCost : null,
          itemCost: !isNaN(parsedItemCost) ? parsedItemCost : null,
        },
      ]);
  
      setNewProduct({ id: '', name: '', productType: '', totalCost: '', itemCost: '' });
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error adding product:', error);
      setSuccessMessage('Error adding product. Please try again.');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleDeleteProduct = async (id) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the product with Barcode Number "${id}"?`
    );
    if (!confirmed) return;
  
    const productRef = ref(database, `products/${id}`);
    try {
      await remove(productRef);
      setProducts(products.filter((product) => product.id !== id));
      setSuccessMessage('Product deleted successfully!');
      setTimeout(() => setSuccessMessage(null), 3000); // Clear success message
    } catch (error) {
      console.error('Error deleting product:', error);
      setErrorMessage('Error deleting product. Please try again.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Start Editing Product
  const handleEditProduct = (product) => {
    setEditingProduct(product);
  };

  // Save Changes to Product
  const handleSaveChanges = async () => {
    const productRef = ref(database, `products/${editingProduct.id}`);
    try {
      const parsedTotalCost = parseFloat(editingProduct.totalCost);
      const parsedItemCost = parseFloat(editingProduct.itemCost);

      await set(productRef, {
        name: editingProduct.name.trim() || 'Unnamed Product',
        productType: editingProduct.productType.trim() || 'Unknown Type',
        totalCost: !isNaN(parsedTotalCost) ? parsedTotalCost : null,
        itemCost: !isNaN(parsedItemCost) ? parsedItemCost : null,
      });

      setProducts(products.map((product) =>
        product.id === editingProduct.id
          ? { ...editingProduct, totalCost: parsedTotalCost, itemCost: parsedItemCost }
          : product
      ));

      setSuccessMessage('Product updated successfully!');
      setEditingProduct(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error updating product:', error);
      setErrorMessage('Error updating product. Please try again.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  return (
    <div className="admin-container">
      <h1 className="admin-title">Product Management</h1>

      {successMessage && <div className="admin-success">{successMessage}</div>}
      {errorMessage && <div className="admin-error">{errorMessage}</div>}

      <div className="admin-form">
        <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
        <input
          type="text"
          placeholder="Barcode Number"
          value={editingProduct ? editingProduct.id : newProduct.id}
          disabled={!!editingProduct}
          onChange={(e) =>
            editingProduct
              ? setEditingProduct({ ...editingProduct, id: e.target.value })
              : setNewProduct({ ...newProduct, id: e.target.value })
          }
          className="admin-input"
        />
        <input
          type="text"
          placeholder="Product Name"
          value={editingProduct ? editingProduct.name : newProduct.name}
          onChange={(e) =>
            editingProduct
              ? setEditingProduct({ ...editingProduct, name: e.target.value })
              : setNewProduct({ ...newProduct, name: e.target.value })
          }
          className="admin-input"
        />
        <input
          type="text"
          placeholder="Product Type (e.g., oil or filters)"
          value={editingProduct ? editingProduct.productType : newProduct.productType}
          onChange={(e) =>
            editingProduct
              ? setEditingProduct({ ...editingProduct, productType: e.target.value })
              : setNewProduct({ ...newProduct, productType: e.target.value })
          }
          className="admin-input"
        />
        <input
          type="text"
          placeholder="Total Cost per Product"
          value={editingProduct ? editingProduct.totalCost : newProduct.totalCost}
          onChange={(e) =>
            editingProduct
              ? setEditingProduct({ ...editingProduct, totalCost: e.target.value })
              : setNewProduct({ ...newProduct, totalCost: e.target.value })
          }
          className="admin-input"
        />
        <input
          type="text"
          placeholder="Item Cost"
          value={editingProduct ? editingProduct.itemCost : newProduct.itemCost}
          onChange={(e) =>
            editingProduct
              ? setEditingProduct({ ...editingProduct, itemCost: e.target.value })
              : setNewProduct({ ...newProduct, itemCost: e.target.value })
          }
          className="admin-input"
        />
      {editingProduct ? (
  <>
    <button onClick={handleSaveChanges} className="admin-button">
      Update Product Information
    </button>
    <button
      onClick={() => setEditingProduct(null)}  
      className="admin-button cancel-button"
    >
      Cancel
    </button>
  </>
) : (
  <button onClick={handleAddProduct} className="admin-button">
    Add Product
  </button>
)}
      </div>

      <div className="admin-products">
        <h2>Product List</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Barcode Number</th>
              <th>Name</th>
              <th>Type</th>
              <th>Total Cost</th>
              <th>Item Cost</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.id}</td>
                <td>{product.name || 'N/A'}</td>
                <td>{product.productType || 'N/A'}</td>
                <td>
                  {typeof product.totalCost === 'number'
                    ? `$${product.totalCost.toFixed(2)}`
                    : 'N/A'}
                </td>
                <td>
                  {typeof product.itemCost === 'number'
                    ? `$${product.itemCost.toFixed(2)}`
                    : 'N/A'}
                </td>
                <td>
  <div className="admin-actions">
    <button
      className="admin-edit-button"
      onClick={() => handleEditProduct(product)}
    >
      <i className="fas fa-edit"></i>
    </button>
    <button
      className="admin-delete-button"
      onClick={() => handleDeleteProduct(product.id)}
    >
      <i className="fas fa-trash"></i>
    </button>
  </div>
</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FetchProducts;