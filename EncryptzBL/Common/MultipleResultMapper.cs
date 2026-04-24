using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Reflection;
using System.Text;

namespace EncryptzBL.Common
{
    public static class MultipleResultMapper
    {
        public static (List<T1>, List<T2>) MapTwo<T1, T2>(DataSet ds)
            where T1 : new()
            where T2 : new()
        {
            var list1 = ds.Tables[0].ToList<T1>();
            var list2 = ds.Tables[1].ToList<T2>();

            return (list1, list2);
        }

        public static (List<T1>, List<T2>, List<T3>) MapThree<T1, T2, T3>(DataSet ds)
            where T1 : new()
            where T2 : new()
            where T3 : new()
        {
            return (
                ds.Tables[0].ToList<T1>(),
                ds.Tables[1].ToList<T2>(),
                ds.Tables[2].ToList<T3>()
            );
        }
    }

  
}
