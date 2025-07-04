import React, { useState, useEffect, useRef } from 'react';
import { ref, get, set, remove } from "firebase/database";
import { database } from '../Auth/firebase';
import '../CSS/admin.css';
import * as XLSX from 'xlsx';

const FetchProducts = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');
  const [newProduct, setNewProduct] = useState({
    id: '', // Barcode Number
    name: '',
    productType: '', // Product Type (oil or filters)
    itemCost: '', // Item Cost
    purchasingPrice: '', // Purchasing Price
    quantity: '',
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

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
          // Sort products alphabetically by name after fetching
          const sortedProducts = sortProducts(productList, 'name', 'asc');
          setProducts(sortedProducts);
          setFilteredProducts(sortedProducts);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };
  
    fetchProducts();
  }, []);

  useEffect(() => {
    handleSearch();
  }, [searchTerm, searchCategory, products]);

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setFilteredProducts(products);
      return;
    }

    const term = searchTerm.toLowerCase().trim();
    const filtered = products.filter(product => {
      if (searchCategory === 'all') {
        return (
          product.name.toLowerCase().includes(term) ||
          product.id.toLowerCase().includes(term) ||
          product.productType.toLowerCase().includes(term)
        );
      } else if (searchCategory === 'name') {
        return product.name.toLowerCase().includes(term);
      } else if (searchCategory === 'id') {
        return product.id.toLowerCase().includes(term);
      } else if (searchCategory === 'type') {
        return product.productType.toLowerCase().includes(term);
      }
      return false;
    });

    setFilteredProducts(filtered);
  };

  const sanitizeId = (id) => {
    return id.replace(/[.#$/[\]]/g, '_');
  };

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
  
      const parsedItemCost = parseFloat(newProduct.itemCost);
      const parsedPurchasingPrice = parseFloat(newProduct.purchasingPrice);
  
      await set(productRef, {
        name: newProduct.name.trim() || 'Unnamed Product',
        productType: newProduct.productType.trim() || 'Unknown Type',
        itemCost: !isNaN(parsedItemCost) ? parsedItemCost : null,
        purchasingPrice: !isNaN(parsedPurchasingPrice) ? parsedPurchasingPrice : null,
        quantity: newProduct.quantity || 0, // Save quantity
      });
  
      setSuccessMessage('Product added successfully!');
      const updatedProducts = [
        ...products,
        {
          id: sanitizedId,
          ...newProduct,
          itemCost: !isNaN(parsedItemCost) ? parsedItemCost : null,
          purchasingPrice: !isNaN(parsedPurchasingPrice) ? parsedPurchasingPrice : null,
        },
      ];
      // Sort products alphabetically by name after adding a new product
      const sortedProducts = sortProducts(updatedProducts, 'name', 'asc');
      setProducts(sortedProducts);
  
      setNewProduct({ id: '', name: '', productType: '', itemCost: '', purchasingPrice: '', quantity: '' });
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

  const rowRef = useRef(null);

  // const handleEditProduct = (product) => {
  //   setEditingProduct({ ...product });
  //   setTimeout(() => {
  //     rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  //   }, 100);
  // };

  const handleEditProduct = (product) => {
  setEditingProduct({ ...product, originalId: product.id });
  setTimeout(() => {
    rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
};

  const handleSaveChanges = async () => {
  const oldId = editingProduct.originalId || editingProduct.id;
  const newId = sanitizeId(editingProduct.id);
  
  if (!newId) {
    setErrorMessage("Barcode (ID) cannot be empty.");
    setTimeout(() => setErrorMessage(null), 3000);
    return;
  }

  const newProductRef = ref(database, `products/${newId}`);
  const oldProductRef = ref(database, `products/${oldId}`);

  try {
    const parsedItemCost = parseFloat(editingProduct.itemCost);
    const parsedPurchasingPrice = parseFloat(editingProduct.purchasingPrice);

    // If the ID changed, remove the old one
    if (oldId !== newId) {
      await remove(oldProductRef);
    }

    await set(newProductRef, {
      name: editingProduct.name.trim() || 'Unnamed Product',
      productType: editingProduct.productType.trim() || 'Unknown Type',
      itemCost: !isNaN(parsedItemCost) ? parsedItemCost : null,
      purchasingPrice: !isNaN(parsedPurchasingPrice) ? parsedPurchasingPrice : null,
      quantity: editingProduct.quantity || 0,
    });

    const updatedProducts = products.map((product) =>
      product.id === oldId
        ? {
            ...editingProduct,
            id: newId,
            itemCost: parsedItemCost,
            purchasingPrice: parsedPurchasingPrice
          }
        : product
    );

    setProducts(updatedProducts);
    setEditingProduct(null);
    setSuccessMessage('Product updated successfully!');
    setTimeout(() => setSuccessMessage(null), 3000);
  } catch (error) {
    console.error('Error updating product:', error);
    setErrorMessage('Error updating product. Please try again.');
    setTimeout(() => setErrorMessage(null), 3000);
  }
};
  
  const handleExportToExcel = () => {
    if (products.length === 0) {
      alert("No products available to export.");
      return;
    }
  
    const worksheet = XLSX.utils.json_to_sheet(products);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
  
    XLSX.writeFile(workbook, "Products.xlsx");
  };

  const [sortBy, setSortBy] = useState({ field: 'productType', order: 'asc' });

  const sortProducts = (products, field, order) => {
    return [...products].sort((a, b) => {
      if (a[field] < b[field]) return order === 'asc' ? -1 : 1;
      if (a[field] > b[field]) return order === 'asc' ? 1 : -1;
      return 0;
    });
  };

  useEffect(() => {
    if (products.length) {
      const sorted = sortProducts(products, sortBy.field, sortBy.order);
      setProducts(sorted);
      
      // Apply the search filter to the sorted products
      if (searchTerm.trim()) {
        handleSearch();
      } else {
        setFilteredProducts(sorted);
      }
    }
  }, [sortBy]);

  const handleSort = (field) => {
    setSortBy((prev) => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchCategory('all');
    setFilteredProducts(products);
  };

  return (
    <div className="admin-container">
      <h1 className="admin-title">Product Management</h1>
      
      {successMessage && <div className="admin-success">{successMessage}</div>}
      {errorMessage && <div className="admin-error">{errorMessage}</div>}

      <div className="admin-form">
        <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
        <p>Barcode Number:</p>
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

        <p>Product Name</p>
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

        <p>Product Type:</p>
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
        <p>Quantity</p>
        <input
          type="text"
          placeholder="Quantity"
          value={editingProduct ? editingProduct.quantity : newProduct.quantity}
          onChange={(e) =>
            editingProduct
              ? setEditingProduct({ ...editingProduct, quantity: e.target.value })
              : setNewProduct({ ...newProduct, quantity: e.target.value })
          }
          className="admin-input"
        />
        <p>Item Cost</p>
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
        <p>Purchasing Price</p>
        <input
          type="text"
          placeholder="Purchasing Price"
          value={editingProduct ? editingProduct.purchasingPrice : newProduct.purchasingPrice}
          onChange={(e) =>
            editingProduct
              ? setEditingProduct({ ...editingProduct, purchasingPrice: e.target.value })
              : setNewProduct({ ...newProduct, purchasingPrice: e.target.value })
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

      <div className="search-container">
        <h2>Search Products</h2>
        <div className="search-controls">
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="admin-input search-input"
          />
          <button onClick={handleClearSearch} className="admin-button">
            Clear
          </button>
        </div>
        <div className="search-info">
          {searchTerm && (
            <p>
              Found {filteredProducts.length} product(s) matching "{searchTerm}"
              {searchCategory !== 'all' ? ` in ${searchCategory}` : ''}
            </p>
          )}
        </div>
      </div>

      <button onClick={handleExportToExcel} className="admin-button">
        Export to Excel
      </button>

      <div className="admin-products">
        <h2>Product List</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Barcode Number</th>
              <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                Name {sortBy.field === 'name' ? (sortBy.order === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('productType')} style={{ cursor: 'pointer' }}>
                Type {sortBy.field === 'productType' ? (sortBy.order === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th>Item Cost</th>
              <th>Purchasing Price</th>
              <th>Quantity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id} ref={editingProduct?.id === product.id ? rowRef : null}>
                <td>
                  {editingProduct && editingProduct.id === product.id ? (
                    <input
                      type="text"
                      value={editingProduct.id}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, id: e.target.value })
                      }
                      className="admin-input"
                    />
                  ) : (
                    product.id
                  )}
                </td>
                <td>
                  {editingProduct && editingProduct.id === product.id ? (
                    <input
                      type="text"
                      value={editingProduct.name}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, name: e.target.value })
                      }
                      className="admin-input"
                    />
                  ) : (
                    product.name
                  )}
                </td>
                <td>
                  {editingProduct && editingProduct.id === product.id ? (
                    <input
                      type="text"
                      value={editingProduct.productType}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, productType: e.target.value })
                      }
                      className="admin-input"
                    />
                  ) : (
                    product.productType
                  )}
                </td>
                <td>
                  {editingProduct && editingProduct.id === product.id ? (
                    <input
                      type="text"
                      value={editingProduct.itemCost}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, itemCost: e.target.value })
                      }
                      className="admin-input"
                    />
                  ) : (
                    product.itemCost
                  )}
                </td>
                <td>
                  {editingProduct && editingProduct.id === product.id ? (
                    <input
                      type="text"
                      value={editingProduct.purchasingPrice}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, purchasingPrice: e.target.value })
                      }
                      className="admin-input"
                    />
                  ) : (
                    product.purchasingPrice
                  )}
                </td>
                <td>
                  {editingProduct && editingProduct.id === product.id ? (
                    <input
                      type="text"
                      value={editingProduct.quantity}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, quantity: e.target.value })
                      }
                      className="admin-input"
                    />
                  ) : (
                    product.quantity
                  )}
                </td>
                <td>
                  {editingProduct && editingProduct.id === product.id ? (
                    <>
                      <button onClick={handleSaveChanges} className="admin-button">
                        Save
                      </button>
                      <button
                        onClick={() => setEditingProduct(null)}
                        className="admin-button cancel-button"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="admin-button edit-button"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="admin-button delete-button"
                      >
                        Delete
                      </button>
                    </>
                  )}
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