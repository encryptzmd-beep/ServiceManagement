using System;
using System.Collections.Generic;
using System.Data;
using System.Reflection;
using System.Text;

namespace EncryptzBL.Common
{
    public static class DataTableExtensions
    {
        public static List<T> ToList<T>(this DataTable table) where T : new()
        {
            var list = new List<T>();

            foreach (DataRow row in table.Rows)
            {
                var item = new T();
                var properties = typeof(T).GetProperties(BindingFlags.Public | BindingFlags.Instance);

                foreach (var prop in properties)
                {
                    if (!table.Columns.Contains(prop.Name) || row[prop.Name] == DBNull.Value)
                        continue;

                    var value = row[prop.Name];
                    var targetType = Nullable.GetUnderlyingType(prop.PropertyType) ?? prop.PropertyType;

                    try
                    {
                        // 🔥 FIX: Handle Boolean conversion (INT -> BOOL)
                        if (targetType == typeof(bool))
                        {
                            value = Convert.ToInt32(value) == 1;
                        }
                        // 🔥 Handle DateOnly
                        else if (targetType == typeof(DateOnly))
                        {
                            value = DateOnly.FromDateTime(Convert.ToDateTime(value));
                        }
                        // 🔥 Handle TimeOnly
                        else if (targetType == typeof(TimeOnly))
                        {
                            value = TimeOnly.FromDateTime(Convert.ToDateTime(value));
                        }
                        else
                        {
                            value = Convert.ChangeType(value, targetType);
                        }

                        prop.SetValue(item, value);
                    }
                    catch
                    {
                        // Optional: ignore mapping errors instead of crashing
                        // You can log here if needed
                    }
                }

                list.Add(item);
            }

            return list;
        }
    }
}
