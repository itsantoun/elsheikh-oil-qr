// import React, { useState, useEffect } from 'react';
// import { ref, get, set, remove } from "firebase/database";
// import { database } from '../Auth/firebase';
// import '../CSS/admin.css';

// const FetchProducts = () => {
//   const [products, setProducts] = useState([]);
//   const [newProduct, setNewProduct] = useState({
//     id: '',
//     name: '',
//     category: '',
//     price: '',
//   });
//   const [successMessage, setSuccessMessage] = useState(null);
//   const [errorMessage, setErrorMessage] = useState(null);

//   // Fetch Products
//   useEffect(() => {
//     const fetchProducts = async () => {
//       try {
//         const productsRef = ref(database, 'products');
//         const snapshot = await get(productsRef);
//         if (snapshot.exists()) {
//           const data = snapshot.val();
//           const productList = Object.keys(data).map((key) => ({
//             id: key,
//             ...data[key],
//           }));
//           setProducts(productList);
//         }
//       } catch (error) {
//         console.error("Error fetching products:", error);
//       }
//     };

//     fetchProducts();
//   }, []);

//   const sanitizeId = (id) => {
//     // Replace invalid Firebase path characters with an underscore or encode them
//     return id.replace(/[.#$/[\]]/g, '_');
//   };
  
//   // Add Product
//   const handleAddProduct = async () => {
//     if (!newProduct.id) {
//       setSuccessMessage("Product ID is required!");
//       setTimeout(() => setSuccessMessage(null), 3000);
//       return;
//     }
  
//     const sanitizedId = sanitizeId(newProduct.id); // Sanitize the ID
//     const productRef = ref(database, `products/${sanitizedId}`);
  
//     try {
//       // Check if the sanitized ID already exists
//       const snapshot = await get(productRef);
//       if (snapshot.exists()) {
//         setSuccessMessage("Product ID already exists. Please use a unique ID.");
//         setTimeout(() => setSuccessMessage(null), 3000);
//         return;
//       }
  
//       // Add the new product
//       await set(productRef, {
//         name: newProduct.name.trim() || 'Unnamed Product',
//         category: newProduct.category.trim() || 'Uncategorized',
//         price: newProduct.price ? parseFloat(newProduct.price) : null,
//       });
  
//       setSuccessMessage('Product added successfully!');
//       setProducts([
//         ...products,
//         { id: sanitizedId, ...newProduct },
//       ]);
//       setNewProduct({ id: '', name: '', category: '', price: '' }); // Clear form
//       setTimeout(() => setSuccessMessage(null), 3000); // Clear success message
//     } catch (error) {
//       console.error('Error adding product:', error);
//       setSuccessMessage('Error adding product. Please try again.');
//       setTimeout(() => setSuccessMessage(null), 3000);
//     }
//   };

//   // Delete Product
//   const handleDeleteProduct = async (id) => {
//     const productRef = ref(database, `products/${id}`);
//     try {
//       if (window.confirm(`Are you sure you want to delete the product with ID "${id}"?`)) {
//         await remove(productRef);
//         setProducts(products.filter((product) => product.id !== id));
//         setSuccessMessage('Product deleted successfully!');
//         setTimeout(() => setSuccessMessage(null), 3000); // Clear success message
//       }
//     } catch (error) {
//       console.error('Error deleting product:', error);
//       setErrorMessage('Error deleting product. Please try again.');
//       setTimeout(() => setErrorMessage(null), 3000);
//     }
//   };

//   return (
//     <div className="admin-container">
//       <h1 className="admin-title">Product Management</h1>

//       {/* Success & Error Messages */}
//       {successMessage && <div className="admin-success">{successMessage}</div>}
//       {errorMessage && <div className="admin-error">{errorMessage}</div>}

//       {/* Add Product Form */}
//       <div className="admin-form">
//         <h2>Add New Product</h2>
//         <input
//           type="text"
//           placeholder="Product ID (e.g., 'prod123')"
//           value={newProduct.id}
//           onChange={(e) =>
//             setNewProduct({ ...newProduct, id: e.target.value })
//           }
//           className="admin-input"
//         />
//         <input
//           type="text"
//           placeholder="Product Name"
//           value={newProduct.name}
//           onChange={(e) =>
//             setNewProduct({ ...newProduct, name: e.target.value })
//           }
//           className="admin-input"
//         />
//         <input
//           type="text"
//           placeholder="Category"
//           value={newProduct.category}
//           onChange={(e) =>
//             setNewProduct({ ...newProduct, category: e.target.value })
//           }
//           className="admin-input"
//         />
//         <input
//           type="text"
//           placeholder="Price (optional)"
//           value={newProduct.price}
//           onChange={(e) =>
//             setNewProduct({ ...newProduct, price: e.target.value })
//           }
//           className="admin-input"
//         />
//         <button
//           onClick={handleAddProduct}
//           className="admin-button"
//         >
//           Add Product
//         </button>
//       </div>

//       {/* Product List */}
//       <div className="admin-products">
//         <h2>Product List</h2>
//         <table className="admin-table">
//           <thead>
//             <tr>
//               <th>ID</th>
//               <th>Name</th>
//               <th>Category</th>
//               <th>Price</th>
//               <th>Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {products.map((product) => (
//               <tr key={product.id}>
//                 <td>{product.id}</td>
//                 <td>{product.name || 'N/A'}</td>
//                 <td>{product.category || 'N/A'}</td>
//                 <td>
//                   {typeof product.price === 'number'
//                     ? `$${product.price.toFixed(2)}`
//                     : 'N/A'}
//                 </td>
//                 <td>
//                   <button
//                     className="admin-delete-button"
//                     onClick={() => handleDeleteProduct(product.id)}
//                   >
//                     Delete
//                   </button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// };

// export default FetchProducts;


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
    // Replace invalid Firebase path characters with an underscore or encode them
    return id.replace(/[.#$/[\]]/g, '_');
  };

  // Add Product
  const handleAddProduct = async () => {
    if (!newProduct.id) {
      setSuccessMessage("Barcode Number is required!");
      setTimeout(() => setSuccessMessage(null), 3000);
      return;
    }
  
    const sanitizedId = sanitizeId(newProduct.id); // Sanitize the ID
    const productRef = ref(database, `products/${sanitizedId}`);
  
    try {
      // Check if the sanitized ID already exists
      const snapshot = await get(productRef);
      if (snapshot.exists()) {
        setSuccessMessage("Barcode Number already exists. Please use a unique ID.");
        setTimeout(() => setSuccessMessage(null), 3000);
        return;
      }
  
      // Add the new product
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
  
      setNewProduct({ id: '', name: '', productType: '', totalCost: '', itemCost: '' }); // Clear form
      setTimeout(() => setSuccessMessage(null), 3000); // Clear success message
    } catch (error) {
      console.error('Error adding product:', error);
      setSuccessMessage('Error adding product. Please try again.');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id) => {
    const productRef = ref(database, `products/${id}`);
    try {
      if (window.confirm(`Are you sure you want to delete the product with Barcode Number "${id}"?`)) {
        await remove(productRef);
        setProducts(products.filter((product) => product.id !== id));
        setSuccessMessage('Product deleted successfully!');
        setTimeout(() => setSuccessMessage(null), 3000); // Clear success message
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      setErrorMessage('Error deleting product. Please try again.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  return (
    <div className="admin-container">
      <h1 className="admin-title">Product Management</h1>

      {/* Success & Error Messages */}
      {successMessage && <div className="admin-success">{successMessage}</div>}
      {errorMessage && <div className="admin-error">{errorMessage}</div>}

      {/* Add Product Form */}
      <div className="admin-form">
        <h2>Add New Product</h2>
        <input
          type="text"
          placeholder="Barcode Number"
          value={newProduct.id}
          onChange={(e) =>
            setNewProduct({ ...newProduct, id: e.target.value })
          }
          className="admin-input"
        />
        <input
          type="text"
          placeholder="Product Name"
          value={newProduct.name}
          onChange={(e) =>
            setNewProduct({ ...newProduct, name: e.target.value })
          }
          className="admin-input"
        />
        <input
          type="text"
          placeholder="Product Type (e.g., oil or filters)"
          value={newProduct.productType}
          onChange={(e) =>
            setNewProduct({ ...newProduct, productType: e.target.value })
          }
          className="admin-input"
        />
        <input
          type="text"
          placeholder="Total Cost per Product"
          value={newProduct.totalCost}
          onChange={(e) =>
            setNewProduct({ ...newProduct, totalCost: e.target.value })
          }
          className="admin-input"
        />
        <input
          type="text"
          placeholder="Item Cost"
          value={newProduct.itemCost}
          onChange={(e) =>
            setNewProduct({ ...newProduct, itemCost: e.target.value })
          }
          className="admin-input"
        />
        <button onClick={handleAddProduct} className="admin-button">
          Add Product
        </button>
      </div>

      {/* Product List */}
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
                  <button
                    className="admin-delete-button"
                    onClick={() => handleDeleteProduct(product.id)}
                  >
                    Delete
                  </button>
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