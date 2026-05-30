// 'use client';

import { useState } from 'react';
import { RiSearchLine } from '@remixicon/react';
import {
  Card,
  Dialog,
  DialogPanel,
  List,
  ListItem,
  ProgressBar,
  TextInput,
} from '@tremor/react';

const orders = [
  {
    name: 'ID-2340',
    date: '31/08/2023 13:45',
  },
  {
    name: 'ID-2344',
    date: '30/08/2023 10:41',
  },
  {
    name: 'ID-1385',
    date: '29/08/2023 09:01',
  },
  {
    name: 'ID-1393',
    date: '29/08/2023 09:23',
  },
  {
    name: 'ID-1264',
    date: '28/08/2023 15:12',
  },
  {
    name: 'ID-434',
    date: '27/08/2023 14:27',
  },
  {
    name: 'ID-1234',
    date: '26/08/2023 11:34',
  },
  {
    name: 'ID-1235',
    date: '25/08/2023 18:50',
  },
  {
    name: 'ID-1236',
    date: '24/08/2023 16:22',
  },
  {
    name: 'ID-1237',
    date: '23/08/2023 12:15',
  },
  {
    name: 'ID-1238',
    date: '22/08/2023 09:30',
  },
  {
    name: 'ID-1239',
    date: '21/08/2023 08:08',
  },
  {
    name: 'ID-1240',
    date: '20/08/2023 07:55',
  },
  {
    name: 'ID-1241',
    date: '19/08/2023 17:09',
  },
  {
    name: 'ID-1242',
    date: '18/08/2023 19:40',
  },
  {
    name: 'ID-1243',
    date: '17/08/2023 14:59',
  },
  {
    name: 'ID-1244',
    date: '16/08/2023 10:15',
  },
  {
    name: 'ID-1245',
    date: '15/08/2023 20:30',
  },
  {
    name: 'ID-1246',
    date: '14/08/2023 08:40',
  },
  {
    name: 'ID-1247',
    date: '13/08/2023 12:57',
  },
  {
    name: 'ID-1248',
    date: '12/08/2023 16:03',
  },
  {
    name: 'ID-1249',
    date: '11/08/2023 19:22',
  },
  {
    name: 'ID-1250',
    date: '10/08/2023 09:47',
  },
  {
    name: 'ID-1251',
    date: '09/08/2023 13:30',
  },
  {
    name: 'ID-1252',
    date: '08/08/2023 08:15',
  },
  {
    name: 'ID-1253',
    date: '07/08/2023 20:00',
  },
  {
    name: 'ID-1254',
    date: '06/08/2023 17:30',
  },
];

export default function Example() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const filteredItems = orders.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  return (
    <>
      <Card className="sm:mx-auto sm:max-w-lg">
        <h3 className="font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
          Order overview
        </h3>
        <ProgressBar
          value={78.2}
          className="mt-6 [&>*]:bg-tremor-border [&>*]:dark:bg-dark-tremor-border"
        />
        <ul role="list" className="mt-4 flex items-center justify-between">
          <li className="flex space-x-2.5">
            <span
              className="flex w-0.5 bg-tremor-brand dark:bg-dark-tremor-brand"
              aria-hidden={true}
            />
            <div className="space-y-0.5">
              <p className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                Fulfilled
              </p>
              <p className="font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                1,543{' '}
                <span className="font-normal text-tremor-content dark:text-dark-tremor-content">
                  (78.2%)
                </span>
              </p>
            </div>
          </li>
          <li className="flex justify-end space-x-2.5">
            <div className="space-y-0.5">
              <p className="text-right text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                Open
              </p>
              <p className="font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                431{' '}
                <span className="font-normal text-tremor-content dark:text-dark-tremor-content">
                  (21.8%)
                </span>
              </p>
            </div>
            <span
              className="flex w-0.5 bg-tremor-border dark:bg-dark-tremor-border"
              aria-hidden={true}
            />
          </li>
        </ul>
        <div className="mt-6 flex items-center justify-between">
          <p className="text-tremor-label font-medium uppercase tracking-wide text-tremor-content-strong dark:text-dark-tremor-content-strong">
            Open orders
          </p>
          <p className="text-tremor-label font-medium uppercase tracking-wide text-tremor-content-strong dark:text-dark-tremor-content-strong">
            Order date
          </p>
        </div>
        <List>
          {orders.slice(0, 5).map((item) => (
            <ListItem key={item.name}>
              <span>{item.name}</span>
              <span>{item.date}</span>
            </ListItem>
          ))}
        </List>
        <div className="absolute inset-x-0 bottom-0 flex justify-center rounded-b-tremor-default bg-gradient-to-t from-tremor-background to-transparent py-7 dark:from-dark-tremor-background">
          <button
            className="flex items-center justify-center rounded-tremor-small border border-tremor-border bg-tremor-background px-2.5 py-2 text-tremor-default font-medium text-tremor-content-strong shadow-tremor-input hover:bg-tremor-background-muted dark:border-dark-tremor-border dark:bg-dark-tremor-background dark:text-dark-tremor-content-strong dark:shadow-dark-tremor-input hover:dark:bg-dark-tremor-background-muted"
            onClick={() => setIsOpen(true)}
          >
            Show more
          </button>
        </div>
        <Dialog
          open={isOpen}
          onClose={() => setIsOpen(false)}
          static={true}
          className="z-[100]"
        >
          <DialogPanel className="overflow-hidden p-0">
            <div className="px-6 pb-4 pt-6">
              <TextInput
                icon={RiSearchLine}
                placeholder="Search ID..."
                className="rounded-tremor-small"
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <div className="mt-4 flex items-center justify-between">
                <p className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  Open orders
                </p>
                <p className="text-tremor-label font-medium uppercase text-tremor-content-emphasis dark:text-dark-tremor-content-emphasis">
                  date
                </p>
              </div>
            </div>
            <div className="h-96 overflow-y-scroll px-6">
              {filteredItems.length > 0 ? (
                <List>
                  {filteredItems.map((item) => (
                    <ListItem key={item.name}>
                      <span>{item.name}</span>
                      <span className="tabular-nums">{item.date}</span>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <p className="flex h-full items-center justify-center text-tremor-default text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  No results.
                </p>
              )}
            </div>
            <div className="mt-4 border-t border-tremor-border bg-tremor-background-muted p-6 dark:border-dark-tremor-border dark:bg-dark-tremor-background">
              <button
                className="flex w-full items-center justify-center rounded-tremor-small border border-tremor-border bg-tremor-background py-2 text-tremor-default font-medium text-tremor-content-strong shadow-tremor-input hover:bg-tremor-background-muted dark:border-dark-tremor-border dark:bg-dark-tremor-background dark:text-dark-tremor-content-strong dark:shadow-dark-tremor-input hover:dark:bg-dark-tremor-background-muted"
                onClick={() => setIsOpen(false)}
              >
                Go back
              </button>
            </div>
          </DialogPanel>
        </Dialog>
      </Card>
    </>
  );
}