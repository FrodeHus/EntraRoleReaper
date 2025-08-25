using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Data.Migrations
{
    /// <inheritdoc />
    public partial class v043 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TargetResourceProperties_TargetResourceId_PropertyName",
                table: "TargetResourceProperties");

            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                table: "TargetResourceProperties",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TargetResourceProperties_TargetResourceId",
                table: "TargetResourceProperties",
                column: "TargetResourceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TargetResourceProperties_TargetResourceId",
                table: "TargetResourceProperties");

            migrationBuilder.DropColumn(
                name: "DisplayName",
                table: "TargetResourceProperties");

            migrationBuilder.CreateIndex(
                name: "IX_TargetResourceProperties_TargetResourceId_PropertyName",
                table: "TargetResourceProperties",
                columns: new[] { "TargetResourceId", "PropertyName" },
                unique: true);
        }
    }
}
