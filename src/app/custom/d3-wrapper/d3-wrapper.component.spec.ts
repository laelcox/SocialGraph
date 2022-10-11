import { ComponentFixture, TestBed } from '@angular/core/testing';

import { D3WrapperComponent } from './d3-wrapper.component';

describe('D3WrapperComponent', () => {
  let component: D3WrapperComponent;
  let fixture: ComponentFixture<D3WrapperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ D3WrapperComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(D3WrapperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
