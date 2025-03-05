import React from 'react';

export const Input = ({ type, value, onChange, placeholder, className, disabled }) => {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`border border-gray-300 rounded px-3 py-2 ${className}`}
      disabled={disabled}
    />
  );
};
