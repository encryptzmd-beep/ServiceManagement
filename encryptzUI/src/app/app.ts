import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { installDateRangeGuard } from './Encryptz/Services/date-range-guard';
import { RouterOutlet } from '@angular/router';
import { AppDialogComponent } from './Encryptz/components/app-dialog-component/app-dialog-component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('encryptzUI');

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) installDateRangeGuard(inject(DOCUMENT));
  }
}
