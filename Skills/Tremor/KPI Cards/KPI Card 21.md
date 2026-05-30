// 'use client';

import { Card, CategoryBar } from '@tremor/react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const data = [
  {
    name: 'Average tokes per requests',
    total: '341',
    split: [40, 60],
    details: [
      {
        name: 'Completion tokens',
        value: '136',
      },
      {
        name: 'Prompt tokens',
        value: '205',
      },
    ],
  },
  {
    name: 'Total tokens',
    total: '4,229',
    split: [35, 65],
    details: [
      {
        name: 'Completion tokens',
        value: '1,480',
      },
      {
        name: 'Prompt tokens',
        value: '2,749',
      },
    ],
  },
  {
    name: 'Total tokens by advanced model',
    total: '1,040',
    split: [25, 75],
    details: [
      {
        name: 'Completion tokens',
        value: '260',
      },
      {
        name: 'Prompt tokens',
        value: '780',
      },
    ],
  },
  {
    name: 'Total tokens by base model',
    total: '2,920',
    split: [29, 71],
    details: [
      {
        name: 'Completion tokens',
        value: '847',
      },
      {
        name: 'Prompt tokens',
        value: '2,073',
      },
    ],
  },
];

const legendColor = {
  'Completion tokens': 'bg-sky-500',
  'Prompt tokens': 'bg-violet-500',
};

export default function Example() {
  return (
    <>
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {data.map((item) => (
          <Card key={item.name}>
            <dt className="truncate text-tremor-default text-tremor-content dark:text-dark-tremor-content">
              {item.name}
            </dt>
            <dd className="mt-1 text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
              {item.total}
            </dd>
            <CategoryBar
              values={item.split}
              colors={['sky', 'violet']}
              showLabels={false}
              className="mt-6"
            />
            <ul
              role="list"
              className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2"
            >
              {item.details.map((category) => (
                <li key={category.name} className="flex items-center space-x-2">
                  <span
                    className={classNames(
                      legendColor[category.name],
                      'size-3 shrink-0 rounded-sm',
                    )}
                    aria-hidden={true}
                  />
                  <span className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                    <span className="font-medium text-tremor-content-emphasis dark:text-dark-tremor-content-emphasis">
                      {category.value}
                    </span>{' '}
                    {category.name}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </dl>
    </>
  );
}