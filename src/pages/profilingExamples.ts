import type { ProfilingRun } from "../types";

function col(
  column_name: string,
  data_type: string,
  row_count: number,
  null_count: number,
  distinct_count: number,
  min_value: string | null,
  max_value: string | null,
) {
  return { column_name, data_type, row_count, null_count, distinct_count, min_value, max_value };
}

export const EXAMPLE_RUNS: ProfilingRun[] = [
  {
    id: "__example_customers__",
    connection_id: "__example__",
    connection_name: "AdventureWorks (example)",
    schema: "Sales",
    table: "Customers",
    ran_at: "2024-11-14T09:22:04Z",
    profiles: [
      col("CustomerID",    "int",        15420,  0,    15420, "1",             "15420"),
      col("FirstName",     "nvarchar",   15420,  0,    1832,  "Aaron",         "Zoe"),
      col("LastName",      "nvarchar",   15420,  0,    4521,  "Abbott",        "Young"),
      col("Email",         "nvarchar",   15420,  234,  15186, "a.adams@mail.com", "z.young@mail.com"),
      col("Phone",         "nvarchar",   15420,  1842, 13578, "+1-200-000-0001", "+1-999-999-9999"),
      col("DateOfBirth",   "date",       15420,  98,   8934,  "1945-03-12",    "2005-11-28"),
      col("Country",       "nvarchar",   15420,  0,    47,    "Australia",     "United States"),
      col("IsActive",      "bit",        15420,  0,    2,     "0",             "1"),
    ],
  },
  {
    id: "__example_orders__",
    connection_id: "__example__",
    connection_name: "AdventureWorks (example)",
    schema: "Sales",
    table: "Orders",
    ran_at: "2024-11-14T09:24:51Z",
    profiles: [
      col("OrderID",         "int",      48230,  0,     48230, "1",            "48230"),
      col("CustomerID",      "int",      48230,  0,     12840, "1",            "15420"),
      col("OrderDate",       "date",     48230,  0,     1826,  "2019-01-01",   "2024-12-31"),
      col("ShippedDate",     "date",     48230,  3421,  1823,  "2019-01-03",   "2024-12-31"),
      col("TotalAmount",     "decimal",  48230,  0,     32840, "0.99",         "9847.50"),
      col("Status",          "nvarchar", 48230,  0,     6,     "Cancelled",    "Shipped"),
      col("ShippingCountry", "nvarchar", 48230,  421,   52,    "Australia",    "United States"),
    ],
  },
  {
    id: "__example_products__",
    connection_id: "__example__",
    connection_name: "AdventureWorks (example)",
    schema: "Production",
    table: "Products",
    ran_at: "2024-11-14T09:25:18Z",
    profiles: [
      col("ProductID",      "int",       847,  0,   847, "1",           "847"),
      col("Name",           "nvarchar",  847,  0,   847, "Adjustable Race", "Women's Tights, S"),
      col("Category",       "nvarchar",  847,  0,   24,  "Accessories", "Vests"),
      col("Price",          "decimal",   847,  0,   712, "1.99",        "2499.99"),
      col("StockQuantity",  "int",       847,  0,   623, "0",           "9999"),
      col("Description",    "nvarchar",  847,  142, 705, null,          null),
      col("CreatedAt",      "datetime",  847,  0,   847, "2018-06-01 08:00:00", "2024-09-30 17:43:12"),
    ],
  },
  {
    id: "__example_employees__",
    connection_id: "__example__",
    connection_name: "HRSystem (example)",
    schema: "HR",
    table: "Employees",
    ran_at: "2024-10-28T14:05:33Z",
    profiles: [
      col("EmployeeID",    "int",       3210,  0,    3210, "1",          "3210"),
      col("FirstName",     "nvarchar",  3210,  0,    874,  "Alice",      "William"),
      col("LastName",      "nvarchar",  3210,  0,    1243, "Adams",      "Zhang"),
      col("Department",    "nvarchar",  3210,  0,    18,   "Accounting", "Sales"),
      col("JobTitle",      "nvarchar",  3210,  0,    94,   "Accountant", "VP of Sales"),
      col("Salary",        "decimal",   3210,  0,    2841, "28000.00",   "320000.00"),
      col("HireDate",      "date",      3210,  0,    2190, "1998-04-07", "2024-10-15"),
      col("TerminationDate","date",     3210,  2847, 1103, "2001-11-30", "2024-09-30"),
      col("ManagerID",     "int",       3210,  142,  287,  "2",          "3208"),
      col("IsRemote",      "bit",       3210,  0,    2,    "0",          "1"),
    ],
  },
];
