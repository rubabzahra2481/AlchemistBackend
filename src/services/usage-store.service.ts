import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const STORE_DIR = path.join(process.cwd(), '.usage-data');
const CREDIT_FILE = path.join(STORE_DIR, 'credit-usage.json');
const BUDGET_FILE = path.join(STORE_DIR, 'budget-usage.json');

@Injectable()
export class UsageStoreService implements OnModuleInit {
  private creditData: Record<string, any> = {};
  private budgetData: Record<string, any> = {};

  onModuleInit() {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    this.creditData = this.loadFile(CREDIT_FILE);
    this.budgetData = this.loadFile(BUDGET_FILE);
    console.log(`💾 [UsageStore] Loaded ${Object.keys(this.creditData).length} credit records, ${Object.keys(this.budgetData).length} budget records`);
  }

  private loadFile(filePath: string): Record<string, any> {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (e: any) {
      console.warn(`⚠️ [UsageStore] Could not load ${filePath}: ${e.message}`);
    }
    return {};
  }

  private saveFile(filePath: string, data: Record<string, any>): void {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e: any) {
      console.error(`❌ [UsageStore] Could not save ${filePath}: ${e.message}`);
    }
  }

  getCreditRecord(key: string): any | undefined {
    // Re-read from disk so external changes (e.g. simulate-credits-exhausted.js) are visible without restart
    this.creditData = this.loadFile(CREDIT_FILE);
    return this.creditData[key];
  }

  setCreditRecord(key: string, value: any): void {
    this.creditData[key] = value;
    this.saveFile(CREDIT_FILE, this.creditData);
  }

  deleteCreditRecord(key: string): void {
    delete this.creditData[key];
    this.saveFile(CREDIT_FILE, this.creditData);
  }

  getAllCreditKeys(): string[] {
    return Object.keys(this.creditData);
  }

  getBudgetRecord(key: string): any | undefined {
    return this.budgetData[key];
  }

  setBudgetRecord(key: string, value: any): void {
    this.budgetData[key] = value;
    this.saveFile(BUDGET_FILE, this.budgetData);
  }

  deleteBudgetRecord(key: string): void {
    delete this.budgetData[key];
    this.saveFile(BUDGET_FILE, this.budgetData);
  }

  getAllBudgetKeys(): string[] {
    return Object.keys(this.budgetData);
  }
}
