// 'use client';

import { useState } from 'react';
import { RiCloseLine } from '@remixicon/react';
import { BarList, Card } from '@tremor/react';
import CountUp from 'react-countup';

// This example requires third-pary library 'react-countup' for counting animation
// npm install react-countup

const country = [
  {
    name: 'United States of America',
    value: 5422,
  },
  {
    name: 'India',
    value: 3560,
  },
  {
    name: 'Germany',
    value: 680,
  },
  {
    name: 'Brazil',
    value: 580,
  },
  {
    name: 'United Kingdom',
    value: 510,
  },
];

const valueFormatter = (number) =>
  `${Intl.NumberFormat('us').format(number).toString()}`;

const initialSum = country.reduce(
  (sum, dataPoint) => sum + (dataPoint.value || 0),
  0,
);

export default function Example() {
  const [values, setValues] = useState({
    start: initialSum,
    end: initialSum,
  });
  const [selectedItem, setSelectedItem] = useState(undefined);

  const handleBarClick = (item) => {
    setSelectedItem(item.name);
    setValues(() => ({
      start: initialSum,
      end: item.value,
    }));
  };

  const clearSelectedItem = () => {
    setSelectedItem(undefined);
    setValues((prev) => ({
      start: prev.end,
      end: initialSum,
    }));
  };

  return (
    <>
      {/* Custom color used for better contrast for placeholder metric card */}
      <div className="rounded-tremor-default border border-dashed border-gray-300 p-6 dark:border-dark-tremor-content-subtle sm:mx-auto sm:max-w-lg">
        <span className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
          Visitors
        </span>
        <p className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
          <CountUp start={values.start} end={values.end} duration={0.4} />
        </p>
      </div>
      <Card className="mt-4 sm:mx-auto sm:max-w-lg">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-medium leading-7 text-tremor-content-strong dark:text-dark-tremor-content-strong">
            Locations
          </p>
          {selectedItem && (
            <button
              type="button"
              onClick={clearSelectedItem}
              className="group inline-flex items-center gap-x-1.5 rounded-tremor-small bg-tremor-background-muted px-2 py-1.5 text-tremor-label text-tremor-content-strong ring-1 ring-inset ring-tremor-ring hover:bg-tremor-background-subtle dark:bg-tremor-content/20 dark:text-dark-tremor-content-strong dark:ring-tremor-content-subtle/20 hover:dark:bg-tremor-content/30"
              aria-label="Remove"
            >
              Country
              <span className="font-semibold">{selectedItem}</span>
              <RiCloseLine
                className="-mr-px size-4 shrink-0 text-tremor-content group-hover:text-tremor-content-emphasis dark:text-dark-tremor-content group-hover:dark:text-dark-tremor-content-emphasis"
                aria-hidden={true}
              />
            </button>
          )}
        </div>
        <div className="mt-6">
          <BarList
            data={country.filter(
              (item) => !selectedItem || item.name === selectedItem,
            )}
            valueFormatter={valueFormatter}
            onValueChange={(item) => handleBarClick(item)}
          />
        </div>
      </Card>
    </>
  );
}