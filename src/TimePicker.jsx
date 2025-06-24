import React, { useState } from 'react';

const TimePicker = () => {
  const [selectedTime, setSelectedTime] = useState('60');

  const options = [
    { value: '60', label: 'Seconds' },
    { value: '180', label: 'Minutes' },
    { value: '3600', label: 'Hours' },
    { value: '86400', label: 'Days' },
    { value: '29040', label: 'Weeks' },
    { value: '3420', label: 'Months' },
    { value: '31536000', label: 'Years' }
  ];

  const defaultSelected = options.find(option => option.value === selectedTime) || null;

  return (
    <select
      value={selectedTime}
      onChange={(e) => setSelectedTime(e.target.value)}
      className="w-48 p-2 border rounded-md bg-white dark:bg-gray-800 dark:border-gray-600"
    >
      {options.map((option, index) => (
        <option
          key={index}
          value={option.value}
          selected={defaultSelected?.value === option.value}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default TimePicker;