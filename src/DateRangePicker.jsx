import React from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

// Custom hook to validate the date range
function useDateRangeValidator(start, end) {
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (start && end && start > end) {
      setError('Start date cannot be after end date.');
    } else {
      setError(null);
    }
  }, [start, end]);

  return { error };
}

// Reusable DateRangePicker component
const DateRangePicker = ({ startDate, endDate, setStartDate, setEndDate }) => {
  const { error } = useDateRangeValidator(startDate, endDate);

  return (
    <div>
      <DatePicker
        selected={startDate}
        onChange={(date) => setStartDate(date)}
        dateFormat="yyyy-MM-dd"
        className="date-picker-input"
      />
      <span style={{ color: 'red' }}>{error && error}</span>

      <DatePicker
        selected={endDate}
        onChange={(date) => setEndDate(date)}
        dateFormat="yyyy-MM-dd"
        className="date-picker-input"
        isClearable={false}
      />
      <span style={{ color: 'red' }}>{error && error}</span>
    </div>
  );
};

export default DateRangePicker;