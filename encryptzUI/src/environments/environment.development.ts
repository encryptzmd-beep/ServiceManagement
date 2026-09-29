import { ApiService } from "../app/Encryptz/Services/API/api-service";

// src/environments/environment.ts
export const environment = {
  production: false,
//apiUrl: 'https://serviceapp.encryptz.in/api'
    // apiUrl:'https://app.encryptz.in'
  // apiUrl:'http://192.168.1.39:5092'
  apiUrl:'http://localhost:5092',

  // Customer portal: the project (MainDB Projects.ProjectKey) whose database customers
  // register / log in to. A link with ?project=KEY overrides it for that browser.
  customerProjectKey: 'C001-P001'
};

// src/environments/environment.prod.ts
// export const environment = {
//   production: true,
//   apiUrl: 'https://api.felixfitness.in'
// };
