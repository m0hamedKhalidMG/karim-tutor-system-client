import React from 'react';

export default function DataTable({ columns, data, onRowClick }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri} onClick={() => onRowClick && onRowClick(row)} className={onRowClick ? 'clickable' : ''}>
              {columns.map((col, ci) => (
                <td key={ci}>
                  {col.render ? col.render(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
