import { Component, signal } from '@angular/core';
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
}
