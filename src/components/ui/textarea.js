import React from 'react';

export const Textarea = ({ value, onChange, placeholder, className, disabled }) => {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`border border-gray-300 rounded px-3 py-2 ${className}`}
      disabled={disabled}
    />
  );
};
