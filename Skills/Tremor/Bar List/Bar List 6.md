// 'use client';

import {
  BarList,
  Card,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from '@tremor/react';

const country = [
  {
    name: 'United States of America',
    value: 2422,
  },
  {
    name: 'India',
    value: 1560,
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

const city = [
  {
    name: 'London',
    value: 1393,
  },
  {
    name: 'New York',
    value: 1219,
  },
  {
    name: 'Mumbai',
    value: 921,
  },
  {
    name: 'Berlin',
    value: 580,
  },
  {
    name: 'San Francisco',
    value: 492,
  },
];

const tabs = [
  {
    name: 'Country',
    data: country,
  },
  {
    name: 'City',
    data: city,
  },
];

const valueFormatter = (number) =>
  `${Intl.NumberFormat('us').format(number).toString()}`;

export default function Example() {
  return (
    <>
      <Card className="sm:mx-auto sm:max-w-lg">
        <TabGroup defaultIndex={1}>
          <div className="flex items-center justify-between">
            <p className="font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
              Locations
            </p>
            <TabList
              variant="solid"
              className="overflow-visible bg-transparent p-0"
            >
              {tabs.map((item) => (
                <Tab
                  value={item.name}
                  className="font-medium ui-selected:text-tremor-content-strong ui-selected:dark:text-dark-tremor-content-strong"
                >
                  {item.name}
                </Tab>
              ))}
            </TabList>
          </div>
          <TabPanels className="mt-6">
            {tabs.map((item) => (
              <TabPanel key={item.name}>
                <BarList data={item.data} valueFormatter={valueFormatter} />
              </TabPanel>
            ))}
          </TabPanels>
        </TabGroup>
      </Card>
    </>
  );
}