import React from 'react';
import FetchProducts from './fetchProducts'; // Import FetchProducts if needed

const Admin = () => {
  return (
    <div>
      <h1>Admin Panel</h1>
      {/* Include FetchProducts only if you need it */}
      <FetchProducts />
    </div>
  );
};

export default Admin;