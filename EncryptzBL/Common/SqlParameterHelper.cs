using Microsoft.Data.SqlClient;
using System;
using System.Collections.Generic;
using System.Data;
using System.Text;

namespace EncryptzBL.Common
{
    public static class SqlParameterHelper
    {
        public static SqlParameter Input(string name, object value)
        {
            return new SqlParameter(name, value ?? DBNull.Value);
        }

        public static SqlParameter Output(string name, SqlDbType type)
        {
            return new SqlParameter(name, type)
            {
                Direction = ParameterDirection.Output
            };
        }

        public static SqlParameter InputOutput(string name, SqlDbType type, object value)
        {
            return new SqlParameter(name, type)
            {
                Value = value ?? DBNull.Value,
                Direction = ParameterDirection.InputOutput
            };
        }

        public static T GetOutputValue<T>(SqlParameter parameter)
        {
            if (parameter.Value == DBNull.Value)
                return default;
            return (T)parameter.Value;
        }
    }
}
